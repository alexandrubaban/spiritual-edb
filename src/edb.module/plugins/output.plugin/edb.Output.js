/**
 * Output input.
 * @TODO: Don't broadcast global!
 */
edb.Output = {

	/**
	 * Identification.
	 * @returns {String}
	 */
	toString : function () {
		return "[object edb.Output]";
	},

	/**
	 * Output data in context. @TODO: some complicated argument combos to explain here
	 * @param {Window|WebWorkerGlobalScope} context
	 * @param {object|array|edb.Type} data
	 * @param @optional {function|string} Type
	 * @returns {edb.Object|edb.Array}
	 */
	dispatch : function ( context, data, Type ) {
		var input = edb.Input.format ( context, data, Type );
		input.type.output = input; // TODO: RENAME this abomination
		gui.Broadcast.dispatch ( null, edb.BROADCAST_OUTPUT, input, context.gui.$contextid );
		return input.data;
	}
};