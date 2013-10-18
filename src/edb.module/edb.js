/*
 * Namepace object.
 */
window.edb = gui.namespace ( "edb", {
	
	/**
	 * 
	 */
	debug : true,

	/**
	 * Although it should probably be false until we have full support...
	 * @type {boolean}
	 */
	portals : false,

	/**
	 * Mount compiled functions as blob files 
	 * (if at all supported) to aid debugging?
	 * @type {boolean}
	 */
	useblobs : true, // @TODO: somehow map to local gui.debug

	/**
	 * Constants.
	 */
	BROADCAST_ACCESS : "edb-broadcast-access",
	BROADCAST_CHANGE : "edb-broadcast-change",
	BROADCAST_OUTPUT : "edb-broadcast-output",
	BROADCAST_SCRIPT_INVOKE : "edb-broadcast-script-invoke",
	LIFE_SCRIPT_WILL_RUN : "edb-life-script-will-run",
	LIFE_SCRIPT_DID_RUN : "edb-life-script-did-run",
	TICK_SCRIPT_UPDATE : "edb-tick-script-update",
	TICK_COLLECT_INPUT : "edb-tick-collect-input",
	TICK_PUBLISH_CHANGES : "edb-tick-update-changes",

	/**
	 * Register action to execute later.
	 * @param {function} action
	 * @param {object} thisp
	 * @returns {function}
	 */
	set : function ( action, thisp ) {
		return edb.Script.$assign ( action, thisp );
	},

	get : function ( key, sig ) {
		return edb.Script.$tempname ( key, sig );
	},

	/**
	 * Execute action.
	 * @TODO: why was this split up in two steps? Sandboxing?
	 * @param {Event} e
	 * @param {String} key
	 * @param @optional {String} sig
	 */
	go : function ( e, key, sig ) { // NOTE: gui.UpdateManager#_attschanged hardcoded "edb.go" ...
		edb.Script.$register ( e );
		edb.Script.$invoke ( key, sig ); // this._log
	}
	
});
