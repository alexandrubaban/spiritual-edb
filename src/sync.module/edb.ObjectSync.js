/**
 * 
 * @param {edb.ObjectChange} change
 * @param {String} instanceid
 */
edb.ObjectSync = function ( change, instanceid ) {
	gui.Object.extend ( this, edb.ObjectSync.filter ( change ));
	this.$instanceid = instanceid;
};

edb.ObjectSync.prototype = {
	name: null,
  type: null,
  newValue: null,
  $instanceid: null
};

/**
 * Trim the change by removing `object` and `oldValue`. 
 * @param {edb.ObjectChange} change
 * @returns {object}
 */
edb.ObjectSync.filter = function ( change ) {
	return gui.Object.map ( change, function ( key, value ) {
		if ( !key.match ( /oldValue|object/ )) {
			return value;
		}
	});
};