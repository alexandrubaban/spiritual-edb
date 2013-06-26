/**
 * edb.Object change summary.
 * @param {edb.Object} object
 * @param {String} name
 * @param {String} type
 * @param {object} oldval
 * @param {object} newval
 */
edb.Change = function ( object, name, type, oldval, newval ) {
	this.instanceid = object._instanceid;
	this.object = object;
	this.name = name;
	this.type = type;
	this.oldValue = oldval;
	this.newValue = newval;
};

edb.Change.prototype = {
	instanceid : null,
	object: null,
	name: null,
	type: null,
	oldValue: undefined,
	newValue: undefined
};

/**
 * We support type "updated" only until 
 * native 'Object.observe' comes along.
 * @type {String}
 */
edb.Change.TYPE_UPDATED = "updated";