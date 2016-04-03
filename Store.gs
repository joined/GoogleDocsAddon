/**
 * Objects that acts as a proxy to the userProperties properties store
 */
var Store = {
    props: PropertiesService.getUserProperties(),
    /**
     * Get a variable from the store
     * @param  {String} name   variable name
     * @return {Object}        variable
     */
    get: function (name) {
        var prop = this.props.getProperty(name);

        if (prop !== null) return JSON.parse(this.props.getProperty(name));

        return null;
    },
    /**
     * Save a variable to the store
     * @param {String} name  variable name
     * @param {Object} value variable value
     */
    set: function(name, value) {
        this.props.setProperty(name, JSON.stringify(value)) ;
    },
    /**
     * Push an element to a stored array
     * @param  {String} arrayName name of the array
     * @param  {Object} element   element to push
     */
    pushElementToArray: function(arrayName, element) {
        var array = this.get(arrayName);

        if (array === null) array = [];

        array.push(element);

        this.set(arrayName, array);
    },
    /**
     * Deletes all stored properties
     */
    reset: function()  {
        this.props.deleteAllProperties();
    },
    /**
     * Get all the stored properties
     * @return {Object} object representing all the stored properties
     */
    getAll: function() {
        return this.props.getProperties();
    }
};
