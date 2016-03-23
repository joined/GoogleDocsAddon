/**
 * Annotation object definition
 * @param {Boolean} match       extraction (true) or unextraction (false)
 * @param {Number} startOffset start offset
 * @param {Number} endOffset   end offset
 * @param {String} text         annotation text
 */
var Annotation = function (index, match, startOffset, endOffset, text) {
    this.index = index;
    this.match = match;
    this.startOffset = startOffset;
    this.endOffset = endOffset;
    this.text = text;
};

/**
 * JSON serialization of Annotation object
 * @return {String} serialized JSON of object
 */
Annotation.prototype.toJSON = function () {
    return JSON.stringify({
        index: this.index,
        match: this.match,
        startOffset: this.startOffset,
        endOffset: this.endOffset,
        text: this.text
    });
};

/**
 * JSON deserialization of Annotation object
 * @param  {String} json   string containing object to deserialize
 * @return {Object}        new Annotation object
 */
Annotation.fromJSON = function (json) {
    var ann = JSON.parse(json);

    return new Annotation(
        ann.index,
        ann.match,
        ann.startOffset,
        ann.endOffset,
        ann.text
    );
};
