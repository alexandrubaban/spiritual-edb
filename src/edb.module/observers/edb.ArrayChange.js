/**
 * @see http://wiki.ecmascript.org/doku.php?id=harmony:observe#array.observe
 * @param {edb.Array} array
 */
edb.ArrayChange = function ( array, index, removed, added ) {
	this.object = array;
	this.index = index;
	this.removed = removed;
	this.added = added;
};

edb.ArrayChange.prototype = {
	type : "splice",
	object : null,
	index : -1,
	removed : null,
	added : null,
};

/*
 * Update types. 
 */
edb.ArrayChange.TYPE_SPLICE = "splice";
/*
edb.ArrayChange.TYPE_ADD = "add";
edb.ArrayChange.TYPE_UPDATE = "update";
edb.ArrayChange.TYPE_DELETE = "delete";
*/