/**
 * Trigger that is fired when the document is opened
 */
function onOpen() {
    DocumentApp
        .getUi()
        .createAddonMenu()
        .addItem('Start', 'showSidebar')
        .addToUi();
}

/**
 * Trigger that is fired when the addon is installed
 */
function onInstall() {
    saveDefaults();
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
 * Save to the Store the constants
 */
function saveDefaults() {
    Store.set('desired-extractions-color', '#3b8e00');
    Store.set('desired-unextractions-color', '#b0281a');
    Store.set('system-extractions-color', '#4c8ffb');
    Store.set('query-color', '#ff00ff');
    Store.set('default-color', '#ffffff');

    Store.set('extractor-has-run', 'false');

    Store.set('desired-extractions-highlight-status', 'on');
    Store.set('desired-unextractions-highlight-status', 'on');
    Store.set('system-extractions-highlight-status', 'on');
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
 * Adds a new annotation to the annotation store
 * @param {TextRange} annotation   annotation to save
 * @param {String} type            type of the annotation (des. extr / des. unextr)
 */
function addNewAnnotation(newAnnotation, type) {
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

    return;
}

/**
 * Saves current selection as desired extraction/unextraction, returning
 * the new text range
 * @param {String} type   type of annotation, can be 'desired-extraction' or 'desired-unxtraction'
 * @return {TextRange}    the text range corresponding to the current selection
 */
function addSelectionAsAnnotation(type) {
    var newAnnotation = getSelectionAsTextRange();

    addNewAnnotation(newAnnotation, type);

    return newAnnotation;
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
function reDrawHighlights(extractionResult) {
    var desiredExtractions   = Store.get('desired-extractions'),
        desiredUnextractions = Store.get('desired-unextractions'),
        desiredExtractionsColor   = Store.get('desired-extractions-color'),
        desiredUnextractionsColor = Store.get('desired-unextractions-color'),
        systemExtractionsColor    = Store.get('system-extractions-color'),
        queryColor                = Store.get('query-color'),
        desiredExtractionsHighlightStatus   = Store.get('desired-extractions-highlight-status'),
        desiredUnextractionsHighlightStatus = Store.get('desired-unextractions-highlight-status'),
        systemExtractionsHighlightStatus    = Store.get('system-extractions-highlight-status'),
        extractionHasRun                    = Store.get('extractor-has-run');

    resetBackground();

    var body = DocumentApp
            .getActiveDocument()
            .getBody();

    // Highlight desired extractions
    if (desiredExtractions !== null && desiredExtractions.length && desiredExtractionsHighlightStatus === 'on') {
        for (var i = 0; i < desiredExtractions.length; i++) {
            body
                .editAsText()
                .setBackgroundColor(desiredExtractions[i].startOffset,
                                    desiredExtractions[i].endOffset,
                                    desiredExtractionsColor);
        }
    }

    // Highlight desired unextractions
    if (desiredUnextractions !== null && desiredUnextractions.length && desiredUnextractionsHighlightStatus === 'on') {
        for (var j = 0; j < desiredUnextractions.length; j++) {
            body
                .editAsText()
                .setBackgroundColor(desiredUnextractions[j].startOffset,
                                    desiredUnextractions[j].endOffset,
                                    desiredUnextractionsColor);
        }
    }

    if (extractionHasRun !== 'true') return;

    if (typeof extractionResult === 'undefined') {
        extractionResult = getExtractionResult();
    }

    var systemExtractions = extractionResult.systemExtractions,
        query             = extractionResult.query;

    if (systemExtractionsHighlightStatus === 'on') {
        // Highlight system extractions
        for (var k = 0; k < systemExtractions.length; k++) {
            body
                .editAsText()
                .setBackgroundColor(systemExtractions[k].startOffset,
                                    systemExtractions[k].endOffset,
                                    systemExtractionsColor);
        }
    }

    // Highlight query
    body
        .editAsText()
        .setBackgroundColor(query.startOffset,
                            query.endOffset,
                            queryColor);
}

/**
 * Gets desired extractions/unextractions
 * @return {Object} array of desired extractions and unextractions
 */
function getSavedStatus() {
    var desiredExtractions   = Store.get('desired-extractions'),
        desiredUnextractions = Store.get('desired-unextractions'),
        systemExtractions    = null,
        query                = null,
        desiredExtractionsHighlightStatus   = Store.get('desired-extractions-highlight-status'),
        desiredUnextractionsHighlightStatus = Store.get('desired-unextractions-highlight-status'),
        systemExtractionsHighlightStatus    = Store.get('system-extractions-highlight-status');

    if (Store.get('extractor-has-run') === 'true') {
        var resultsObject        = getExtractionResult();

        systemExtractions = resultsObject.systemExtractions;
        query = resultsObject.query;
    }

    return {desiredExtractions: desiredExtractions,
            desiredUnextractions: desiredUnextractions,
            systemExtractions: systemExtractions,
            query: query,
            desiredExtractionsHighlightStatus: desiredExtractionsHighlightStatus,
            desiredUnextractionsHighlightStatus: desiredUnextractionsHighlightStatus,
            systemExtractionsHighlightStatus: systemExtractionsHighlightStatus};
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
 * Run the extractor with the current desired extractions / unextractions, and get the results (sys. extr. and query)
 * @return {Object} object representing the system extractions and the query
 */
function getExtractionResult() {
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

    // Get only system extractions that are not overlapping with desired extractions or desired unextractions
    var nonOverlappingSystemExtractions = systemExtractions.filter(function(systemExtraction) {
        var annotations = desiredExtractions.concat(desiredUnextractions);
        for (var i = 0; i < annotations.length; i++) {
            if (TextRange.areOverlapping(systemExtraction, annotations[i])) {
                return false;
            }
        }

        return true;
    });

    return {systemExtractions: nonOverlappingSystemExtractions,
            query: query};
}

/**
 * Runs the extractor, highlights result and returns extractor results
 * @return {Object} results of the extractor and query
 */
function runExtractor() {
    var extractionResult = getExtractionResult();

    Store.set('extractor-has-run', 'true');

    Store.set('system-extractions-highlight-status', 'on');

    // Update highlights
    reDrawHighlights(extractionResult);

    return extractionResult;
}

/**
 * Reset the addon status
 */
function resetEverything() {
    Store.reset();
    resetBackground();
    saveDefaults();

    return;
}

/**
 * Exports current saved system extractions to a new document, one line each
 */
function exportExtractions() {
    var desiredExtractions   = Store.get('desired-extractions'),
        desiredUnextractions = Store.get('desired-unextractions');

    if (desiredExtractions === null ||
        desiredUnextractions === null ||
        !desiredExtractions.length ||
        !desiredUnextractions.length) {
        throw "You must have at least one desired extraction and one desired unextraction";
    }

    var systemExtractions = getExtractionResult().systemExtractions,
        exportDoc = DocumentApp.create("Extractions export"),
        body = exportDoc.getBody();

    body.appendParagraph(
        systemExtractions.map(function(systemExtraction) {
            return systemExtraction.text;
        }).join('\n')
    );

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

/**
 * Change highlight status of one type of annotations (des. extr / des. unextr / sys. extr.)
 * @param {String} type   type of the annotation to change the highlight status of
 * @param {String} status new status
 */
function setHighlightStatus(type, status) {
    if (type === 'desired-extractions') Store.set('desired-extractions-highlight-status', status);
    else if (type === 'desired-unextractions') Store.set('desired-unextractions-highlight-status', status);
    else if (type === 'system-extractions') Store.set('system-extractions-highlight-status', status);
    else throw "Type of annotation not recognized";

    reDrawHighlights();
}
