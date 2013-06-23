/*
 * Namepace object.
 */
window.edb = gui.namespace ( "edb", {
	
	/**
	 * Identification.
	 * @returns {String}
	 */
	toString : function () { return "[namespace edb]"; },

	/**
	 * Mount compiled functions as blob files 
	 * (if at all supported) to aid debugging?
	 * @type {boolean}
	 */
	useblobs : true, // @TODO: somehow map to local gui.debug

	/**
	 * Constants.
	 */
	BROADCAST_GETTER : "edb-broadcast-getter",
	BROADCAST_SETTER : "edb-broadcast-setter",
	BROADCAST_OUTPUT : "edb-broadcast-output",
	BROADCAST_FUNCTION_LOADED : "edb-broadcast-function-loaded",
	BROADCAST_TAG_LOADED : "edb-broadcast-tag-loaded",
	BROADCAST_SCRIPT_INVOKE : "edb-broadcast-script-invoke",
	LIFE_SCRIPT_WILL_RUN : "edb-life-script-will-run",
	LIFE_SCRIPT_DID_RUN : "edb-life-script-did-run",
	TICK_SCRIPT_UPDATE : "edb-tick-script-update",
	TICK_COLLECT_INPUT : "edb-tick-collect-input"
	
});
