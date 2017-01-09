/**
 * Object that represents a set, i.e. array with unique values
 * @param {Object} array   array of set's elements
 */
function Set(array) {
    this.data = [];
    // Save only unique values
    var u = {};
    for(var i = 0, l = array.length; i < l; ++i){
       if(u.hasOwnProperty(array[i])) {
          continue;
       }
       this.data.push(array[i]);
       u[array[i]] = 1;
    }
}

Set.prototype = {
    /**
     * Compute intersection of the current set with another one,
     * doesn't modify the original
     * @param  {Set} otherSet   set to intersect with the current one
     * @return {Set}            intersection of the two sets
     */
    intersection: function (otherSet) {
        var result = [];
        for (var i = 0; i < this.data.length; i++) {
            for (var j = 0; j < otherSet.data.length; j++) {
                if (this.data[i] === otherSet.data[j]) {
                    result.push(this.data[i]);
                    break;
                }
            }
        }

        return new Set(result);
    },
    /**
     * Size of the current set
     * @return {Number}   number of elements of the current set
     */
    size: function () {
        return this.data.length;
    },
    /**
     * Compute union of the current set with another one,
     * doesn't modify the original
     * @param  {Set} otherSet   set to join with the current one
     * @return {Set}            union of the two sets
     */
    union: function (otherSet) {
        return new Set(this.data.concat(otherSet.data));
    }
};
