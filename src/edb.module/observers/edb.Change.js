/**
 * edb.Object property change summary.
 * @param {edb.Object} object
 * @param {String} name
 * @param {String} type
 * @param {object} oldval
 * @param {object} newval
 */
edb.Change = function ( object, name, type, oldval, newval ) {
	this.object = object;
	this.name = name;
	this.type = type;
	this.oldValue = oldval;
	this.newValue = newval;
};

edb.Change.prototype = {
	object: null,
	name: null,
	type: null,
	oldValue: undefined,
	newValue: undefined
};