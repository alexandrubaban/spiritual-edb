/**
 * @see http://wiki.ecmascript.org/doku.php?id=harmony:observe#array.observe
 * @param {edb.Array} array
 */
edb.ArrayChange = function ( array, index, removed, added ) {
	this.type = edb.ArrayChange.TYPE_SPLICE; // hardcoded for now
	this.object = array;
	this.index = index;
	this.removed = removed;
	this.added = added;
};

edb.ArrayChange.prototype = gui.Object.create ( edb.Change.prototype, {

	/**
	 * Index of change.
	 * @type {}
	 */
	index : -1,

	/**
	 * List removed members.
	 * @todo What should happen to them?
	 * @type {Array}
	 */
	removed : null,

	/**
	 * List added members.
	 * @type {Array}
	 */
	added : null

});

/*
 * Update types. 
 */
edb.ArrayChange.TYPE_SPLICE = "splice";
/*
edb.ArrayChange.TYPE_ADD = "add";
edb.ArrayChange.TYPE_UPDATE = "update";
edb.ArrayChange.TYPE_DELETE = "delete";
*/