/*global DocumentApp, PropertiesService, HtmlService, Logger, Annotation, AnnotationsStore*/
/*jslint vars: true*/

/**
 * Deletes all saved user properties
 */
function deleteAllUserProperties() {
    var userProperties = PropertiesService.getUserProperties();
    userProperties.deleteAllProperties();
}

/**
 * Saves default user properties
 */
function saveDefaultProperties() {
    var userProperties = PropertiesService.getUserProperties();

    userProperties.setProperty('ANNOTATIONS_N', '0');

    userProperties.setProperty('DEFAULT_COL', '#ffffff'); // Default color
    userProperties.setProperty('DES_EXTR_COL', '#00ff00'); // Desired extraction color
    userProperties.setProperty('DES_UNEXTR_COL', '#ff0000'); // Desired extraction color
    userProperties.setProperty('SYS_EXTR_COL', '#0000ff');  // System extraction color
}

/**
 * Resets document background to default color
 * @return {[type]} [description]
 */
function resetBackground() {
    var body = DocumentApp
            .getActiveDocument()
            .getBody();

    var userProperties = PropertiesService.getUserProperties();
    var defaultColor = userProperties.getProperty('DEFAULT_COL');
    var bodyLength = body.editAsText().getText().length - 1;

    body
        .editAsText()
        .setBackgroundColor(0, bodyLength, defaultColor);
}

/**
 * Restores annotations background after reset
 */
function reEnableBackground() {
    var i, savedAnnotations = AnnotationsStore.getSavedAnnotations();

    var body = DocumentApp
            .getActiveDocument()
            .getBody();

    var userProperties = PropertiesService.getUserProperties();
    var desiredExtractionColor = userProperties.getProperty('DES_EXTR_COL'),
        desiredUnextractionColor = userProperties.getProperty('DES_UNEXTR_COL');

    for (i = 0; i < savedAnnotations.length; i += 1) {
        if (savedAnnotations[i].match) {
            body
                .editAsText()
                .setBackgroundColor(savedAnnotations[i].startOffset,
                                    savedAnnotations[i].endOffset,
                                    desiredExtractionColor);
        } else {
            body
                .editAsText()
                .setBackgroundColor(savedAnnotations[i].startOffset,
                                    savedAnnotations[i].endOffset,
                                    desiredUnextractionColor);
        }


    }
}

/**
 * Trigger activated when the document is opened
 */
/*jslint unparam: true*/
function onOpen(e) {
    DocumentApp
        .getUi()
        .createAddonMenu()
        .addItem('Start', 'showSidebar')
        .addToUi();


    // For testing purposes, we reset the document highlighting upon opening
    resetBackground();

    // Reset saved properties and save the default ones
    deleteAllUserProperties();
    saveDefaultProperties();
}

/**
 * Trigger activated when he addon is installed
 */
function onInstall(e) {
    onOpen(e);
}

/**
 * HTML templating function
 * @param  {String} filename   name of the file to be included
 * @return {String}            file contents
 */
function include(filename) {
    return HtmlService
            .createHtmlOutputFromFile(filename)
            .getContent();
}

/**
 * Opens the sidebar generating the HTML from the template
 */
function showSidebar() {
    var ui = HtmlService
        .createTemplateFromFile('Sidebar')
        .evaluate()
        .setTitle('Find similar items')
        .setSandboxMode(HtmlService.SandboxMode.IFRAME);

    DocumentApp
        .getUi()
        .showSidebar(ui);
}

/**
 * Converts local offset (i.e. referred to the paragraph start) to global
 * @param  {Integer} paragraphNumber   number of the paragraph the offset is referred to
 * @param  {Integer} localOffset       local offset (referred to the paragraph)
 * @return {Integer}                   global offset (referred to the document start)
 */
function localOffsetToGlobal(paragraphNumber, localOffset) {
    var paragraphs = DocumentApp
        .getActiveDocument()
        .getBody()
        .getParagraphs();

    var i, globalOffset = localOffset;

    for (i = 0; i < paragraphNumber; i += 1) {
        globalOffset += paragraphs[i].getText().length + 1;
    }

    return globalOffset;
}

/**
 * Verifies if an annotation is allowed (i.e. not overlapping with an existing one)
 * @param  {Annotation} newAnnotation   new annotation to be checked for
 * @return {Boolean}                    allowed or not
 */
function isAnnotationAllowed(newAnnotation) {
    var i, annotations = AnnotationsStore.getSavedAnnotations();

    // Loop over existing annotations looking for overlapping
    for (i = 0; i < annotations.length; i += 1) {
        if (Math.max(annotations[i].startOffset, newAnnotation.startOffset) <=
                Math.min(annotations[i].endOffset, newAnnotation.endOffset)) {
            return false;
        }
    }

    return true;
}

/**
 * Get current selection as global start and end offsets
 * @return {[Integer]} list with start and end offsets
 */
function getSelectionAsGlobalOffsets() {
    var selection = DocumentApp
        .getActiveDocument()
        .getSelection();

    if (!selection) {throw "You must select something"; }

    var rangeElements = selection.getRangeElements();
    var selectionFirstElement = rangeElements[0],
        selectionLastElement = rangeElements[rangeElements.length - 1];

    var startOffset, endOffset, startParagraphNumber, endParagraphNumber;

    var body = DocumentApp
            .getActiveDocument()
            .getBody();

    // If the first and/or last paragraphs are entirely selected, we get the
    // paragraph number and offset in a different way
    if (!selectionFirstElement.isPartial()) {
        // If the paragraph is entirely selected the start offset is 0
        startOffset = 0;
        startParagraphNumber = body.getChildIndex(selectionFirstElement.getElement());
    } else {
        startOffset = selectionFirstElement.getStartOffset();
        startParagraphNumber = body.getChildIndex(selectionFirstElement
                                    .getElement()
                                    .getParent());
    }

    if (!selectionLastElement.isPartial()) {
        // If the paragraph is entirely selected the start offset is the paragraph length
        endOffset = selectionLastElement.getElement().asText().getText().length - 1;
        endParagraphNumber = body.getChildIndex(selectionLastElement.getElement());
    } else {
        endOffset   = selectionLastElement.getEndOffsetInclusive();
        endParagraphNumber = body.getChildIndex(selectionLastElement
                                    .getElement()
                                    .getParent());
    }

    var startGlobalOffset = localOffsetToGlobal(startParagraphNumber, startOffset),
        endGlobalOffset = localOffsetToGlobal(endParagraphNumber, endOffset);

    return [startGlobalOffset, endGlobalOffset];
}

/**
 * Add current selection as annotation
 * @param {Boolean} match   desired extraction (true) or unextraction (false)
 */
function addSelectionAsAnnotation(match) {
    var userProperties = PropertiesService.getUserProperties();

    var offsets = getSelectionAsGlobalOffsets();
    var startGlobalOffset = offsets[0],
        endGlobalOffset   = offsets[1];

    var body = DocumentApp
            .getActiveDocument()
            .getBody();

    var selectionText = body
        .editAsText()
        .getText()
        .substr(startGlobalOffset, endGlobalOffset - startGlobalOffset + 1);

    var newAnnotation = new Annotation(match,
                                       startGlobalOffset,
                                       endGlobalOffset,
                                       selectionText);

    if (!isAnnotationAllowed(newAnnotation)) {
        throw "Annotation overlapping, not allowed";
    }

    // Desired extraction
    if (match === true) {
        body
            .editAsText()
            .setBackgroundColor(startGlobalOffset, endGlobalOffset, userProperties.getProperty('DES_EXTR_COL'));
    // Desired unextraction
    } else {
        body
            .editAsText()
            .setBackgroundColor(startGlobalOffset, endGlobalOffset, userProperties.getProperty('DES_UNEXTR_COL'));
    }

    AnnotationsStore.saveAnnotation(newAnnotation);

    return newAnnotation;
}

/**
 * Deletes annotations that overlap with current selection
 * @return {[Annotation]} list of deleted annotations
 */
function deleteSelectedAnnotations() {
    var body = DocumentApp
        .getActiveDocument()
        .getBody();

    var offsets = getSelectionAsGlobalOffsets();
    var startGlobalOffset = offsets[0],
        endGlobalOffset   = offsets[1];

    var userProperties = PropertiesService.getUserProperties();

    var i,
        savedAnnotations = AnnotationsStore.getSavedAnnotations(),
        annotationsToDelete = [];

    for (i = 0; i < savedAnnotations.length; i += 1) {
        if (Math.max(startGlobalOffset, savedAnnotations[i].startOffset) <=
                Math.min(endGlobalOffset, savedAnnotations[i].endOffset)) {
            annotationsToDelete.push(savedAnnotations[i]);

            AnnotationsStore.deleteAnnotation(savedAnnotations[i]);

            body
                .editAsText()
                .setBackgroundColor(savedAnnotations[i].startOffset,
                                    savedAnnotations[i].endOffset,
                                    userProperties.getProperty('DEFAULT_COL'));
        }
    }

    if (annotationsToDelete.length) {
        return annotationsToDelete;
    }

    throw "No annotation selected";
}
