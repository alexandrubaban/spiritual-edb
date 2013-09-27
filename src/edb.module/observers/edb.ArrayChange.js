/**
 * @see http://wiki.ecmascript.org/doku.php?id=harmony:observe#array.observe
 * @param {edb.Array} array
 */
edb.ArrayChange = function ( array ) {
	this.instanceid = array._instanceid;
};

edb.ArrayChange.prototype = {
	instanceid : null,
	array : null
};

edb.ArrayChange.TYPE_ADDED = "added";
edb.ArrayChange.TYPE_REMOVED = "removed";