/*global PropertiesService, AnnotationsStore, Logger*/
/**
 * Log all saved annotations
 */
function logAllAnnotations() {
    var i, savedAnnotations = AnnotationsStore.getSavedAnnotations();

    for (i = 0; i < savedAnnotations.length; i += 1) {
        Logger.log("Annotation: " + savedAnnotations[i].toJSON());
    }
}

/**
 * Log all saved user properties
 */
function getUserProperties() {
    var data = PropertiesService.getUserProperties().getProperties();

    for (var key in data) {
      Logger.log('Key: %s, Value: %s', key, data[key]);
    }
}
