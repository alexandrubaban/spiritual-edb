/**
 * @param {edb.Type} type
 * @param {String} name
 */
edb.Access = function ( object, name ) {
	this.instanceid = object._instanceid;
	this.object = object;
	this.name = name;
};

edb.Access.prototype = {
	instanceid : null,
	object : null,
	name : null
};