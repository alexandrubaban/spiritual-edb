/*
 * Namepace object.
 */
window.edb = gui.namespace ( "edb", {

	/**
	 * Identification.
	 * @returns {String}
	 */
	toString : function () {
		return "[namespace edb]";
	},

	BROADCAST_FUNCTION_LOADED : "broadcast-function-loaded",
	BROADCAST_TAG_LOADED : "broadcast-tag-loaded",
	LIFE_SCRIPT_WILL_RUN : "life-script-will-run",
	LIFE_SCRIPT_DID_RUN : "life-script-did-run",
	TICK_SCRIPT_UPDATE : "gui-tick-spiritscript-update",
	TICK_COLLECT_INPUT : "gui-tick-collect-input"

});
