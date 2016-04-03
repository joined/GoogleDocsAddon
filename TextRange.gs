/**
 * Object to represent a text range in a string
 * @param {Number} startOffset   position of the first character in the base string
 * @param {Number} endOffset     position of the last character in the base string
 * @param {String} text          text
 */
function TextRange(startOffset, endOffset, text) {
    this.startOffset = startOffset; //indice carattere iniziale
    this.endOffset = endOffset; //indice carattere finale
    this.text = text;
}

TextRange.areOverlapping = function(firstRange, secondRange) {
    return Math.max(firstRange.startOffset, secondRange.startOffset) <=
            Math.min(firstRange.endOffset, secondRange.endOffset);
};

/**
 * Object to represent a text range in a string with a score
 */
function TextRangeWithScore() {
    // If the arguments are a text range and the score
    if (arguments.length === 2 &&
        arguments[0] instanceof TextRange) {
        TextRange.apply(this, [arguments[0].startOffset, arguments[0].endOffset, arguments[0].text]);
        this.score = arguments[1];
    // If the arguments are the text range properties and a score
    } else if (arguments.length === 4) {
        TextRange.apply(this, [arguments[0], arguments[1], arguments[2]]);
        this.score = arguments[3];
    } else {
        throw "Bad constructor invoking";
    }
}
