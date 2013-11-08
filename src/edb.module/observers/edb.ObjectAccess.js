/**
 * @param {edb.Type} object
 * @param {String} name
 */
edb.ObjectAccess = function ( object, name ) {
	this.instanceid = object._instanceid; // @todo are we using this?
	this.object = object;
	this.name = name;
};

edb.ObjectAccess.prototype = {
	instanceid : null,
	object : null,
	name : null
};