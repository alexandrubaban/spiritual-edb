/*
 * Namepace object.
 */
var edb = gui.namespace ( "edb", {

	/**
	 * Identification.
	 * @returns {String}
	 */
	toString : function () {
		return "[namespace edb]";
	},

	BROADCAST_FUNCTION_LOADED : "broadcast-function-loaded",
	LIFE_SCRIPT_WILL_RUN : "life-script-will-run",
	LIFE_SCRIPT_DID_RUN	: "life-script-did-run",

});