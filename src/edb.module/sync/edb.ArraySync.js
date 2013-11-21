/**
 * 
 * @param {edb.ArrayChange} change
 * @param {String} instanceid
 */
edb.ArraySync = function ( change, instanceid ) {
	this.type = edb.ArrayChange.TYPE_SPLICE;
	this.args = edb.ArrayChange.toSpliceParams ( change );
	this.$instanceid = instanceid;
};

edb.ArraySync.prototype = {
  type: null,
  args: null,
  $instanceid: null
};