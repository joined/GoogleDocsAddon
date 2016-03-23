/*global PropertiesService, Annotation*/
/*jslint vars: true*/
/**
 * AnnotationsStore manages annotations saving and retrieval
 */
function AnnotationsStore() {return; }

/**
 * Get annotations saved in user preferences
 * @return {[Annotation]} list of saved annotations
 */
AnnotationsStore.getSavedAnnotations = function () {
    var userProperties = PropertiesService.getUserProperties();
    var annotationsNumber = parseInt(userProperties.getProperty('ANNOTATIONS_N'), 10);

    var i, savedAnnotations = [];

    for (i = 0; i < annotationsNumber; i += 1) {
        if (userProperties.getProperty('ANN_' + i) !== 'deleted') {
            savedAnnotations.push(Annotation.fromJSON(userProperties.getProperty('ANN_' + i)));
        }
    }

    return savedAnnotations;
};

/**
 * Getter for number of stored annotations
 * @return {Integer} numer of stored annotations
 */
AnnotationsStore.getAnnotationsNumber = function () {
    var userProperties = PropertiesService.getUserProperties();

    return parseInt(userProperties.getProperty('ANNOTATIONS_N'), 10);
};

/**
 * Save new annotation in user properties
 * @param  {Annotation} annotation   annotation to be saved
 */
AnnotationsStore.saveAnnotation = function (annotation) {
    var userProperties = PropertiesService.getUserProperties();
    var newAnnotationNumber = parseInt(userProperties.getProperty('ANNOTATIONS_N'), 10);

    userProperties.setProperty('ANN_' + newAnnotationNumber, annotation.toJSON());

    userProperties.setProperty('ANNOTATIONS_N', newAnnotationNumber + 1);
};

AnnotationsStore.deleteAnnotation = function (annotation) {
    var userProperties = PropertiesService.getUserProperties();

    var annotationsNumber = parseInt(userProperties.getProperty('ANNOTATIONS_N'), 10);

    var i, currentAnnotation;
    for (i = 0; i < annotationsNumber; i += 1) {
        if (userProperties.getProperty('ANN_' + i) !== 'deleted') {
            currentAnnotation = Annotation.fromJSON(userProperties.getProperty('ANN_' + i));

            if (currentAnnotation.startOffset === annotation.startOffset &&
                    currentAnnotation.endOffset === annotation.endOffset) {
                userProperties.setProperty('ANN_' + i, 'deleted');
            }
        }
    }
};
