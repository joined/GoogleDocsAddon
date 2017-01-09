/**
 * Object that represents an entity extractor instance
 * @param {String} string                    input string
 * @param {Object} inputDesiredExtractions   array of TextRange elements with desired extractions
 * @param {Object} inputDesiredUnextractions array of TextRange elements with desired unextractions
 */
function EntityExtractor(string, inputDesiredExtractions, inputDesiredUnextractions) {
    this.baseString = string;
    this.n_context = 5; // characters to consider around the annotation for the context-aware variant
    this.n_validation = 3; // validation procedure number for the context-aware variant
    this.desiredExtractions = inputDesiredExtractions;
    this.desiredUnextractions = inputDesiredUnextractions;
    this.jaccardMatrix = {}; // matrix with computed jaccard similarity index values
}

EntityExtractor.prototype = {
    /**
     * Generate base separator set (S_0)
     * @return {Object} array of base separators
     */
    genBaseSeparatorSet: function() {
        // Build the list of characters immediately preceding and following text ranges in this.desiredExtractions
        var precedingAndFollowingCharacters = [];

        for (var i = 0; i < this.desiredExtractions.length; i++) {
            var precedingCharacterOffset = this.desiredExtractions[i].startOffset - 1,
                followingCharacterOffset = this.desiredExtractions[i].endOffset + 1;

            // Don't try to add the character if we're out the string bounds
            if (precedingCharacterOffset >= 0) {
                precedingAndFollowingCharacters.push(this.baseString.substr(precedingCharacterOffset, 1));
            }
            if (followingCharacterOffset < this.baseString.length) {
                precedingAndFollowingCharacters.push(this.baseString.substr(followingCharacterOffset, 1));
            }
        }

        // Transform the list of preceding and following chars to an object with characters as keys and frequencies as values
        var charactersFrequencyObject = precedingAndFollowingCharacters.reduce(function (counter, item) {
                counter[item] = counter.hasOwnProperty(item) ? counter[item] + 1 : 1;
                return counter;
        }, {});

        // Transform the characters-frequency object into a sortable array of {character, frequency} objects
        var charactersFrequency = [], character;
        for (character in charactersFrequencyObject) {
            if (charactersFrequencyObject.hasOwnProperty(character)) {
                charactersFrequency.push({character: character,
                                          frequency: charactersFrequencyObject[character]});
            }
        }

        // Sort the characters array by descending occurrency value
        charactersFrequency.sort(function (sxCharacterFrequency, dxCharacterFrequency) {
            return dxCharacterFrequency.frequency - sxCharacterFrequency.frequency;
        });

        // Return the array with the pure characters sorted by occurrency
        return charactersFrequency.map(function (characterFrequency) {
            return characterFrequency.character;
        });
    },
    /**
     * Split a string using multiple separators, using regexes
     * @param  {String} string       string to split
     * @param  {Object} separators   array of separator characters
     * @return {Object}              array with splitted string elements
     */
    splitWithMultipleSeparators: function(string, separators) {
        var result = string.split(new RegExp('[' + separators.join('') + ']', 'g'));

        // Remove empty strings from result array
        while (result.indexOf('') !== -1) {
            result.splice(result.indexOf(''), 1);
        }

        return result;
    },
    /**
     * Generates the best separators set (S) for the current desired extractions and base string
     * @return {Object} array of optimal separators
     */
    genBestSeparatorsSet: function() {
        var baseSeparatorSet = this.genBaseSeparatorSet();

        // Generate array of pure strings corresponding to desired extractions
        var desiredExtractionsStrings = this.desiredExtractions.map(function (desiredExtraction) {
            return desiredExtraction.text;
        });

        // Find the best set of separators. It is the one which maximizes the cardinality
        // of the intersection set T_i ∩ this.desiredExtractions, where T_i is the base string splitted
        // using the actual separator set S_i
        var currentSeparatorSet,
            tokenizedString,
            intersection,
            bestSeparatorsSet,
            bestSeparatorSetIntersectionCardinality = -1;

        for (var i = 0; i < baseSeparatorSet.length; i++) {
            // S_i (actual separator set) is made of the first i elements of the base separator set
            currentSeparatorSet = baseSeparatorSet.slice(0, i + 1);

            // Split base string with the current separator set S_i
            tokenizedString = this.splitWithMultipleSeparators(this.baseString, currentSeparatorSet);

            // Find the intersection between the desired extractions strings set and the set of
            // tokens obtained splitting the base string with the current separator set
            intersection = (new Set(desiredExtractionsStrings)).intersection(new Set(tokenizedString));
            if (intersection.size() > bestSeparatorSetIntersectionCardinality) {
                bestSeparatorsSet = currentSeparatorSet;
                bestSeparatorSetIntersectionCardinality = bestSeparatorsSet.length;
            }
        }

       return bestSeparatorsSet;
    },
    /**
     * Calculate n_tokens, which is the maximum number of tokens in which a desired extraction would be divided
     * using the optimal separator set (S)
     * @return {Number} number of consecutive tokens to consider during extraction
     */
    calcNTokens: function() {
        var currentNumberOfTokens, bestN_tokens = 1;

        for (var i = 0; i < this.desiredExtractions.length; i++) {
            currentNumberOfTokens = this.splitWithMultipleSeparators(this.desiredExtractions[i].text, this.bestSeparatorsSet).length;

            if (currentNumberOfTokens > bestN_tokens) {
                bestN_tokens = currentNumberOfTokens;
            }
        }

        return bestN_tokens;
    },
    /**
     * Get the TextRange corresponding to numCharacters chars before given TextRange in base string
     * @param  {TextRange} textRange   TextRange after the characters to extract
     * @param  {Number} numCharacters  number of characters to extract
     * @return {TextRange}             TextRange composed of the characters before the one given
     */
    getRangeBefore: function(textRange, numCharacters) {
        // If there are at least numCharacters characters before the given TextRange,
        // return TextRange made of numCharacters before the given TextRange
        if (textRange.startOffset >= numCharacters) {
            return new TextRange(textRange.startOffset - numCharacters,
                                 textRange.startOffset - 1,
                                 this.baseString.substring(textRange.startOffset - numCharacters, textRange.startOffset - 1));
        // If not, return all possible characters
        } else if (textRange.startOffset !== 0) {
            return new TextRange(0,
                                 textRange.startOffset - 1,
                                 this.baseString.substring(0, textRange.startOffset - 1));
        // If the TextRange starts at the start of the base string
        } else {
            return null;
        }
    },
    /**
     * Get the TextRange corresponding to numCharacters chars after given TextRange in base string
     * @param  {TextRange} textRange   TextRange before the characters to extract
     * @param  {Number} numCharacters  number of characters to extract
     * @return {TextRange}             TextRange composed of the characters after the one given
     */
    getRangeAfter: function(textRange, numCharacters) {
        // If there are at least numCharacters characters after the given TextRange
        // return TextRange made of numCharacters after the given TextRange
        if (textRange.endOffset < this.baseString.length) {
            return new TextRange(textRange.endOffset + 1,
                                 textRange.endOffset + numCharacters,
                                 this.baseString.substr(textRange.endOffset + 1, numCharacters));
        // If not, return all possible characters
        } else if (textRange.endOffset !== this.baseString.length - 1) {
            return new TextRange(textRange.endOffset + 1,
                                 this.baseString.length - 1,
                                 this.baseString.substring(textRange.endOffset + 1, this.baseString.length - 1));
        // If the TextRange ends at the end of the base string
        } else {
            return null;
        }
    },
    /**
     * Given a set of TextRange elements, build the set of TextRange corresponding to the
     * numCharacters chars before the given TextRange elements
     * @param  {Object} inputSet      array of TextRange elements
     * @param  {Number} numCharacters number of characters to extract before the given TextRange elements
     * @return {Object}               array of TextRange elements of "before characters"
     */
    genBeforeSet: function (inputSet, numCharacters) {
        var beforeSet = [];

        for (var i = 0; i < inputSet.length; i++) {
            var textRangeBefore = this.getRangeBefore(inputSet[i], numCharacters);

            if (textRangeBefore !== null) beforeSet.push(textRangeBefore);
        }

        return beforeSet;
    },
    /**
     * Given a set of TextRange elements, build the set of TextRange corresponding to the
     * numCharacters chars after the given TextRange elements
     * @param  {Object} inputSet      array of TextRange elements
     * @param  {Number} numCharacters number of characters to extract after the given TextRange elements
     * @return {Object}               array of TextRange elements of "after characters"
     */
    genAfterSet: function (inputSet, numCharacters) {
        var afterSet = [];

        for (var i = 0; i < inputSet.length; i++) {
            var textRangeAfter = this.getRangeAfter(inputSet[i], numCharacters);

            if (textRangeAfter !== null) afterSet.push(textRangeAfter);
        }

        return afterSet;
    },
    /**
     * Generate 'N' multiset, which is the set of desired unextractions each one splitted
     * with the best separator set
     * @return {Object} N multiset, technically an array of TextRange elements
     */
    generateN: function () {
        // Create N
        var currentN = [];
        for (var i = 0; i < this.desiredUnextractions.length; i++) {
            currentN = currentN.concat(this.tokenize(this.desiredUnextractions[i], this.bestSeparatorsSet));
        }

        return currentN;
    },
    /**
     * Tokenizes a TextRange into a list of TextRange elements using a list of separators
     * @param  {TextRange} textRange   TextRange to tokenize
     * @param  {Object} separators     separators array
     * @return {Object}                array of TextRange elements resulting from tokenization
     */
    tokenize: function (textRange, separators) {
        var tokenList = [], token = '', tokenStartOffset, tokenEndOffset;
        for (var i = 0; i < textRange.text.length; i++) {
            // If the actual character is not a separator, append it to 'token'
            if (separators.indexOf(textRange.text[i]) === -1) {
                if (!token.length) tokenStartOffset = textRange.startOffset + i;

                token += textRange.text[i];

                // If the current character is the last of the textRange.text, push the current token to the list
                if (i === textRange.text.length - 1) {
                    tokenEndOffset = textRange.startOffset + i - 1;

                    tokenList.push(new TextRange(tokenStartOffset, tokenEndOffset, token));
                }
            // If the current character is a separator and 'token' is not the empty textRange.text,
            // add 'token' to the list
            } else if (token.length) {
                tokenEndOffset = textRange.startOffset + i - 1;

                tokenList.push(new TextRange(tokenStartOffset, tokenEndOffset, token));

                token = '';
            }
        }

        return tokenList;
    },
    /**
     * Calculates the list of bigrams from a list of words
     * @param  {Object} inputList   array of words to combine into bigrams
     * @return {Object}             array of bigrams
     */
    bigramsList: function (inputList) {
        var bigramList = [];
        for (var i = 0; i < inputList.length - 1; i++) {
            bigramList.push(inputList[i] + inputList[i + 1]);
        }
        return bigramList;
    },
    /**
     * Calculates the Jaccard similarity index between two strings, using bigrams
     * @param  {String} xString first string
     * @param  {String} yString second string
     * @return {Number} similarity score
     */
    jaccardSimilarityIndex: function (xString, yString) {
        // If there aren't at least two characters in each string, the similarity is 0
        if (xString.length <= 1 || yString.length <= 1) return 0;

        // If the score is already computed use it
        if (xString + '|' + yString in this.jaccardMatrix) {
            return this.jaccardMatrix[xString + '|' + yString];
        }

        // Otherwise, compute the score and save it
        var xSet = new Set(this.bigramsList(xString.split(""))),
            ySet = new Set(this.bigramsList(yString.split(""))),
            intersection = xSet.intersection(ySet),
            union = xSet.union(ySet),
            result = intersection.size() / union.size();

        this.jaccardMatrix[xString + '|' + yString] = result;
        return result;
    },
    /**
     * Difference between the average (Jaccard) similarity of x to strings in A and strings in B
     * deltaM(x) = 1/|A| * \sum_(x' ∈ A) j(x, x') - 1/|B| * \sum_(x' ∈ B) j(x, x')
     * @param  {String} x   reference string
     * @param  {Object} A   first array
     * @param  {Object} B   second array
     * @return {Number}     deltaM score
     */
    deltaM: function (x, A, B) {
        var A_accumulator = 0;
        for (var i = 0; i < A.length; i++) {
            A_accumulator += this.jaccardSimilarityIndex(x, A[i].text);
        }
        var A_average = A_accumulator / A.length;

        var B_accumulator = 0;
        for (var j = 0; j < B.length; j++) {
            B_accumulator += this.jaccardSimilarityIndex(x, B[j].text);
        }
        var B_average = B_accumulator / B.length;

        return A_average - B_average;
    },
    /**
     * Calculates the threshold value τ, which is chosen as the value that
     * maximizes (|x ∈ P; x > τ| + |x ∈ N; x < τ|)
     * @param  {Object} inputP input P multiset (array)
     * @param  {Object} inputN input N multiset (array)
     * @return {Number} τ value computed as explained up here
     */
    calcTau: function (inputP, inputN) {
        var deltaM_list = [];
        for (var k = 0; k < inputP.length; k++) {deltaM_list.push([this.deltaM(inputP[k].text, inputP, inputN), 'P']);}
        for (var z = 0; z < inputN.length; z++) {deltaM_list.push([this.deltaM(inputN[z].text, inputP, inputN), 'N']);}

        deltaM_list.sort(function (sxArray, dxArray) {
            return sxArray[0] - dxArray[0];
        });

        var maxCardinality = 0, bestTau;
        // Iterate over the delta M list and try using the average between the current
        // deltaM and the next deltaM as the tau value
        for (var i = 0; i < deltaM_list.length - 1; i++) {
            var currentTau = (deltaM_list[i][0] + deltaM_list[i + 1][0])/2,
                currentCardinality = 0;

            // Calculate (|x ∈ P; x > tau| + |x ∈ N; x < tau|) using actual tau
            for (var j = 0; j < deltaM_list.length; j++) {
                if ((deltaM_list[j][1] === 'P' && deltaM_list[j][0] > currentTau) ||
                    (deltaM_list[j][1] === 'N' && deltaM_list[j][0] < currentTau)) {
                    currentCardinality++;
                }
            }

            if (currentCardinality > maxCardinality) {
                maxCardinality = currentCardinality;
                bestTau = currentTau;
            }
        }

        return bestTau;
    },
    /**
     * Calculate the accuracy of a (P, N) tuple
     * @param  {Object} inputP   input P multiset (array)
     * @param  {Object} inputN   input N multiset (array)
     * @param  {Number} inputTau input τ threshold value
     * @return {Number}          accuracy of the (P, N) tuple, 0 <= a <= 1
     */
    calcAccuracy: function (inputP, inputN, inputTau) {
        // If |P| < n_validation or |N| < n_validation skip the validation procedure and set a = 1
        if (inputP.length < this.n_validation || inputN.length < this.n_validation) {
            return 1;
        }

        // The current score is the number of guessed classifications
        var score = 0;
        for (var i = 0; i < this.n_validation; i++) {
            // Create P_i, N_i removing the i-th element from the input arrays
            var currentP = inputP.slice(),
                currentN = inputN.slice();

            currentP.splice(i, 1);
            currentN.splice(i, 1);

            var c_P_i = this.deltaM(inputP[i].text, currentP, currentN) - inputTau,
                c_N_i = this.deltaM(inputN[i].text, currentP, currentN) - inputTau;

            // If the deleted desired extraction is classified as to extract, increment the score
            score += c_P_i > 0 ? 1 : 0;
            // If the deleted desired unextraction is classified as not to extract, increment the score
            score += c_N_i < 0 ? 1 : 0;
        }

        // The accuracy corresponds to the classification score divided by 2 * n_validation (max score)
        var accuracy = score / (2 * this.n_validation);

        // If the accuracy is less than 0.5, don't use the corresponding classifier during classification phase
        if (accuracy < 0.5) {
            accuracy = 0;
        }

        return accuracy;
    },
    /**
     * Generate list of numConsecutiveTokens tokens from a list of tokens
     * @param  {Object} tokenList            array of tokens
     * @param  {Number} numConsecutiveTokens number of consecutive tokens to consider
     * @return {Object}                      array of consecutive tokens
     */
    genConsecutiveTokenList: function (tokenList, numConsecutiveTokens) {
        var result = [];

        // If there aren't at least numConsecutiveTokens in the token list,
        // we cannot generate even a single one consecutive token
        if (tokenList.length < numConsecutiveTokens) {
            return null;
        // If the number of consecutive tokens to consider is one, the result is the
        // same as the input list
        } else if (numConsecutiveTokens === 1) {
            return tokenList.slice();
        }

        for (var i = 0; i <= tokenList.length - numConsecutiveTokens; i++) {
            var startOffset = tokenList[i].startOffset,
                endOffset   = tokenList[i + numConsecutiveTokens - 1].endOffset;
            result.push(new TextRange(startOffset,
                                      endOffset,
                                      this.baseString.substring(startOffset, endOffset)));
        }

        return result;
    },
    /**
     * Classify a given string using stored (P, N) tuples, separator set, τ, n_tokens, n_context and accuracies
     * @param  {String} string   input string to be classified
     * @return {Object}          array of TextRangeWithScore elements
     */
    classify: function (string) {
        var tokenList = this.tokenize(new TextRange(0, string.length - 1, string), this.bestSeparatorsSet),
            classifiedTokenList = [];

        // If the number of consecutive tokens to consider is greater than or equal 2, add the lists composed
        // of up to n_tokens consecutive tokens to the tokens list
        if (this.n_tokens >= 2) {
            for (var i = 2; i <= this.n_tokens; i++) {
                tokenList = tokenList.concat(this.genConsecutiveTokenList(tokenList, i));
            }
        }

        for (var j = 0; j < tokenList.length; j++) {
            var textRangeBefore = this.getRangeBefore(tokenList[j], this.n_context),
                textRangeAfter  = this.getRangeAfter(tokenList[j], this.n_context),
                c_before, c_after;

            // If there's no text before or after the current token,
            // don't use it, and the same if there's no P_before or N_before set
            if (textRangeBefore !== null &&
                this.P_before.length &&
                this.N_before.length) {
                c_before = this.deltaM(textRangeBefore.text, this.P_before, this.N_before);
            } else {
                c_before = 0;
                a_before = 0;
            }

            if (textRangeAfter !== null &&
                this.P_after.length &&
                this.N_after.length) {
                c_after  = this.deltaM(textRangeAfter.text, this.P_after, this.N_after);
            } else {
                c_after = 0;
                a_after = 0;
            }

            var c = this.deltaM(tokenList[j].text, this.P, this.N);

            var c_weighted = (this.accuracy_before * c_before +
                              this.accuracy * c +
                              this.accuracy_after * c_after) / 3;

            classifiedTokenList.push(new TextRangeWithScore(tokenList[j], c_weighted));
        }

        classifiedTokenList.sort(function (sxToken, dxToken) {
            return dxToken.score - sxToken.score;
        });

        return classifiedTokenList;
    },
    /**
     * Get computed classified token list
     * @return {Object} array of TextRangeWithScore elements
     */
    getSystemExtractions: function () {
        if (!this.classifiedTokenList) {
            throw "You must run the algorithm before getting the results";
        }

        return this.classifiedTokenList.filter(function(classifiedToken) {
            return classifiedToken.score > 0;
        });
    },
    /**
     * Get query to be submitted to the user. We choose it between all the classified tokens
     * as the one with the lowest absolute score (biggest uncertainty) and that is not
     * overlapping with desired extractions or unextractions
     * @return {TextRangeWithScore} query
     */
    getQuery: function() {
        if (!this.classifiedTokenList) {
            throw "You must run the algorithm before getting the results";
        }

        var classifiedTokenListSortedByAbsScore = this.classifiedTokenList.slice();

        // Sort by descending absolute score
        classifiedTokenListSortedByAbsScore.sort(function (sxClassifiedToken, dxClassifiedToken) {
            return Math.abs(dxClassifiedToken.score) - Math.abs(sxClassifiedToken.score);
        });

        var len = classifiedTokenListSortedByAbsScore.length;

        while (len--) {
            // Check if current token is overlapping with desired extractions or unextractions,
            // in that case skip to the next one
            for (var i = 0; i < this.desiredExtractions.length; i++) {
                if (TextRange.areOverlapping(this.classifiedTokenList[len], this.desiredExtractions[i])) continue;
            }
            for (var j = 0; j < this.desiredUnextractions.length; j++) {
                if (TextRange.areOverlapping(this.classifiedTokenList[len], this.desiredUnextractions[j])) continue;
            }

            return classifiedTokenListSortedByAbsScore[len];
        }

        throw "No non-overlapping token found";
    },
    /**
     * Run the algorithm
     */
    run: function() {
        this.bestSeparatorsSet = this.genBestSeparatorsSet();
        this.n_tokens = this.calcNTokens();
        this.P        = this.desiredExtractions.slice();
        this.P_before = this.genBeforeSet(this.P, this.n_context);
        this.P_after  = this.genAfterSet(this.P,  this.n_context);
        this.N        = this.generateN();
        this.N_before = this.genBeforeSet(this.N, this.n_context);
        this.N_after  = this.genAfterSet(this.N,  this.n_context);
        this.tau        = this.calcTau(this.P,        this.N);
        this.tau_before = this.calcTau(this.P_before, this.N_before);
        this.tau_after  = this.calcTau(this.P_after,  this.N_after);
        this.accuracy        = this.calcAccuracy(this.P,         this.N,        this.tau);
        this.accuracy_before = this.calcAccuracy(this.P_before,  this.N_before, this.tau_before);
        this.accuracy_after  = this.calcAccuracy(this.P_after,   this.N_after,  this.tau_after);
        this.classifiedTokenList = this.classify(this.baseString);
    }
};
