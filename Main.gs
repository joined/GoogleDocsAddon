/**
 * Trigger that is fired when the document is opened
 */
function onOpen() {
    DocumentApp
        .getUi()
        .createAddonMenu()
        .addItem('Start', 'showSidebar')
        .addToUi();

    // Delete everything that was saved in the Store, remove any higlightings
    // and save the default highlight colors in the Store
    Store.reset();
    resetBackground();
    saveDefaultColors();
}

/**
 * Trigger that is fired when the addon is installed
 */
function onInstall() {
    onOpen(e);
}

/**
 * Used to include files with scriptlet tags in HTML
 * @param  {String} filename   name of the file to be included
 * @return {String}            contents of the file
 */
function include(filename) {
    return HtmlService
            .createHtmlOutputFromFile(filename)
            .getContent();
}

/**
 * Creates from template and opens sidebar
 */
function showSidebar() {
    var ui = HtmlService
        .createTemplateFromFile('Sidebar')
        .evaluate()
        .setTitle('Entity Extractor')
        .setSandboxMode(HtmlService.SandboxMode.IFRAME);

    DocumentApp
        .getUi()
        .showSidebar(ui);
}

/**
 * Save to the Store the default highlight colors
 */
function saveDefaultColors() {
    Store.set('desired-extractions-color', '#3b8e00');
    Store.set('desired-unextractions-color', '#b0281a');
    Store.set('system-extractions-color', '#4c8ffb');
    Store.set('default-color', '#ffffff');
}

/**
 * Convert a local offset (i.e. a (paragraph, offset) tuple) to a global one
 * @param  {Number} paragraphNumber number of the paragraph
 * @param  {Number} localOffset     offset in the paragraph
 * @return {Number}                 global offset
 */
function localOffsetToGlobal(paragraphNumber, localOffset) {
    var paragraphs = DocumentApp
        .getActiveDocument()
        .getBody()
        .getParagraphs();

    var i, globalOffset = localOffset;

    for (i = 0; i < paragraphNumber; i++) {
        globalOffset += paragraphs[i].getText().length + 1;
    }

    return globalOffset;
}

/**
 * Checks if a new annotation is allowed, i.e. it's not overlapping with any
 * of the saved annotations
 * @param  {TextRange}  newTextRange   the new annotation
 * @return {Boolean}                   true if it's allowed, false otherwise
 */
function isAnnotationAllowed(newTextRange) {
    var desiredExtractions   = Store.get('desired-extractions'),
        desiredUnextractions = Store.get('desired-unextractions');

    // Loop over existing annotations looking for overlapping
    if (desiredExtractions !== null) {
        for (var i = 0; i < desiredExtractions.length; i++) {
            if (TextRange.areOverlapping(desiredExtractions[i], newTextRange)) return false;
        }
    }

    if (desiredUnextractions !== null) {
        for (var j = 0; j < desiredUnextractions.length; j++) {
            if (TextRange.areOverlapping(desiredUnextractions[j], newTextRange)) return false;
        }
    }

    return true;
}

/**
 * Gets current selection as a TextRange element
 * @return {TextRange} text range representing the selection
 */
function getSelectionAsTextRange() {
    var selection = DocumentApp
        .getActiveDocument()
        .getSelection();

    if (!selection) throw "You must select something";

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

    var selectionText = body
        .editAsText()
        .getText()
        .substring(startGlobalOffset, endGlobalOffset + 1);

    return new TextRange(startGlobalOffset, endGlobalOffset, selectionText);
}

/**
 * Saves current selection as desired extraction/unextraction, returning
 * the new text range
 * @param {String} type   type of annotation, can be 'desired-extraction' or 'desired-unxtraction'
 * @return {TextRange}    the text range corresponding to the current selection
 */
function addSelectionAsAnnotation(type) {
    var newAnnotation = getSelectionAsTextRange();

    if (!isAnnotationAllowed(newAnnotation)) {
        throw "Annotation overlapping, not allowed";
    }

    var highlightColor;
    if (type === 'desired-extraction') {
        Store.pushElementToArray('desired-extractions', newAnnotation);
        highlightColor = Store.get('desired-extractions-color');
    } else if (type === 'desired-unextraction') {
        Store.pushElementToArray('desired-unextractions', newAnnotation);
        highlightColor = Store.get('desired-unextractions-color');
    } else {
        throw 'Invalid annotation type';
    }

    var body = DocumentApp
        .getActiveDocument()
        .getBody();

    body
        .editAsText()
        .setBackgroundColor(newAnnotation.startOffset,
                            newAnnotation.endOffset,
                            highlightColor);

    return newAnnotation;
}


/**
 * Opens a modal to change the highlight colors
 */
function showColorsModal() {
    var html = HtmlService
        .createTemplateFromFile('EditColorModal')
        .evaluate()
        .setSandboxMode(HtmlService.SandboxMode.IFRAME)
        .setWidth(400)
        .setHeight(170);

    DocumentApp
        .getUi()
        .showModalDialog(html, 'Edit Highlight Colors');
}

/**
 * Saves to the store a new list of highlight colors
 * @param  {Object} colorsList   array of colors encoded as strings
 */
function saveNewHighlightColors(colorsList) {
    Store.set('desired-extractions-color',   colorsList[0]);
    Store.set('desired-unextractions-color', colorsList[1]);
    Store.set('system-extractions-color',    colorsList[2]);

    reDrawHighlights();
}

/**
 * Gets current stored highlight colors
 * @return {Object} array of colors encoded as strings
 */
function getHighlightColors() {
    var desiredExtractionsColor   = Store.get('desired-extractions-color');
        desiredUnextractionsColor = Store.get('desired-unextractions-color');
        sysExtractionsColor       = Store.get('system-extractions-color');

    return [desiredExtractionsColor, desiredUnextractionsColor, sysExtractionsColor];
}

/**
 * Deletes any highlight in the document setting its background
 * to the default color
 */
function resetBackground() {
    var body = DocumentApp
            .getActiveDocument()
            .getBody();

    var defaultColor = Store.get('default-color');
    var bodyLength = body.editAsText().getText().length - 1;

    body
        .editAsText()
        .setBackgroundColor(0, bodyLength, defaultColor);
}

/**
 * Draws the highlights corresponding to the saved annotations
 */
function reDrawHighlights() {
    var savedAnnotations = getSavedAnnotations(),
        desiredExtractions   = savedAnnotations.desiredExtractions,
        desiredUnextractions = savedAnnotations.desiredUnextractions,
        systemExtractions    = savedAnnotations.systemExtractions,
        desiredExtractionsColor   = Store.get('desired-extractions-color'),
        desiredUnextractionsColor = Store.get('desired-unextractions-color');
        systemExtractionsColor = Store.get('system-extractions-color');

    var body = DocumentApp
            .getActiveDocument()
            .getBody();

    for (var i = 0; i < desiredExtractions.length; i++) {
        body
            .editAsText()
            .setBackgroundColor(desiredExtractions[i].startOffset,
                                desiredExtractions[i].endOffset,
                                desiredExtractionsColor);
    }

    for (var j = 0; j < desiredUnextractions.length; j++) {
        body
            .editAsText()
            .setBackgroundColor(desiredUnextractions[j].startOffset,
                                desiredUnextractions[j].endOffset,
                                desiredUnextractionsColor);
    }

    for (var k = 0; k < systemExtractions.length; k++) {
        body
            .editAsText()
            .setBackgroundColor(systemExtractions[k].startOffset,
                                systemExtractions[k].endOffset,
                                systemExtractionsColor);
    }
}

/**
 * Gets desired extractions/unextractions and system extractions saved in the store
 * @return {Object} array of desired extractions and unextractions
 */
function getSavedAnnotations() {
    return {desiredExtractions: Store.get('desired-extractions'),
            desiredUnextractions: Store.get('desired-unextractions'),
            systemExtractions: Store.get('system-extractions')};
}

/**
 * Deletes an annotation given its start offset
 * @param  {Number} startOffset the annotation start offset
 */
function deleteAnnotation(startOffset) {
    var desiredExtractions   = Store.get('desired-extractions'),
        desiredUnextractions = Store.get('desired-unextractions'),
        defaultColor         = Store.get('default-color');

    var body = DocumentApp
        .getActiveDocument()
        .getBody();

    if (desiredExtractions !== null) {
        for (var i = 0; i < desiredExtractions.length; i++) {
            if (desiredExtractions[i].startOffset === startOffset) {
                body
                    .editAsText()
                    .setBackgroundColor(desiredExtractions[i].startOffset,
                                        desiredExtractions[i].endOffset,
                                        defaultColor);

                desiredExtractions.splice(i, 1);

                Store.set('desired-extractions', desiredExtractions);

                return;
            }
        }
    }

    if (desiredUnextractions !== null) {
        for (var j = 0; j < desiredUnextractions.length; j++) {
            if (desiredUnextractions[j].startOffset === startOffset) {
                body
                    .editAsText()
                    .setBackgroundColor(desiredUnextractions[j].startOffset,
                                        desiredUnextractions[j].endOffset,
                                        defaultColor);

                desiredUnextractions.splice(j, 1);

                Store.set('desired-unextractions', desiredUnextractions);

                return;
            }
        }
    }
}

/**
 * Run the extractor with the current desired extractions / unextractions
 * @return {TextRange} text range representing the query
 */
function runExtractor() {
    var body = DocumentApp
        .getActiveDocument()
        .getBody();

    var bodyText = body
        .editAsText()
        .getText();

    var desiredExtractions   = Store.get('desired-extractions'),
        desiredUnextractions = Store.get('desired-unextractions'),
        sysExtractionsColor  = Store.get('system-extractions-color');

    var ee = new EntityExtractor(bodyText, desiredExtractions, desiredUnextractions);

    ee.run();

    var systemExtractions = ee.getSystemExtractions(),
        query             = ee.getQuery();

    Store.set('system-extractions', systemExtractions);

    // Highlight the system extractions. Needs to be fixed to show
    // conflicts between desired extractions / unextractions and
    // system extractions
    for (var i = 0; i < systemExtractions.length; i++) {
        body
            .editAsText()
            .setBackgroundColor(systemExtractions[i].startOffset,
                                systemExtractions[i].endOffset - 1,
                                sysExtractionsColor);
    }

    return {systemExtractions: systemExtractions,
            query: query};
}

/**
 * Reset the addon status
 */
function resetEverything() {
    Store.reset();
    resetBackground();
    saveDefaultColors();

    return;
}

/**
 * Exports current saved system extractions to a new document, one line each
 */
function exportExtractions() {
    var exportDoc = DocumentApp.create("Extractions export"),
        systemExtractions = Store.get('system-extractions');

    if (systemExtractions === null) throw "No system extractions available";

    var body = exportDoc.getBody();

    body.appendParagraph(systemExtractions.map(function(systemExtraction) {return systemExtraction.text;}).join('\n'));

    var html = HtmlService
        .createHtmlOutput('<link rel="stylesheet" href="https://ssl.gstatic.com/docs/script/css/add-ons1.css">' +
                          'The system extractions were exported. ' +
                          '<a target="_blank" href="https://docs.google.com/document/d/' + exportDoc.getId() + '/edit#gid=0">Link</a>')
        .setSandboxMode(HtmlService.SandboxMode.IFRAME)
        .setWidth(300)
        .setHeight(50);

    DocumentApp.getUi().showModalDialog(html, 'System extractions export');
}

/**
 * Selects an annotation in the text, given start and end offsets
 * @param  {Number} startOffset annotation start offset
 * @param  {Number} endOffset   annotation end offset
 */
function selectAnnotation(startOffset, endOffset) {
    var doc = DocumentApp.getActiveDocument();
    var rangeBuilder = doc.newRange();
    rangeBuilder.addElement(doc.getBody().editAsText(), startOffset, endOffset);

    doc.setSelection(rangeBuilder.build());
}
