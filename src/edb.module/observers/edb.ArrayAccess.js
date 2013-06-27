/**
 * @param {edb.Array} array
 */
edb.ArrayAccess = function ( array ) {
	this.instanceid = array._instanceid;
	this.array = array;
};

edb.ArrayAccess.prototype = {
	instanceid : null,
	array : null
};