/**
 * Here it is.
 * @extends {edb.Function}
 */
edb.Tag = edb.Function.extend ( "edb.Tag", {

	/**
	 * Adding the "tag" directive.
	 * @overloads {edb.Template#compile}
	 * @param {String} source
	 * @param {HashMap<String,String>} directives
	 * @returns {edb.Function}
	 */
	compile : function ( source, directives ) {
		directives.tag = true;
		return this._super.compile ( source, directives );
	},

	/**
	 * Compiler implementation.
	 * @overwrites {edb.Function#_Compiler}
	 * @type {function}
	 */
	_Compiler : edb.TagCompiler


}, { // Recurring static ......................................

	/**
	 * Mapping src to compiled tags.
	 * @todo Do we need to do this?
	 * @overwrites {edb.Function#_map}
	 * @type {Map<String,function>}
	 */
	_map : Object.create ( null ),

	/**
	 * Message to dispatch when function is loaded. 
	 * The function src appears as broadcast data.
	 * @overwrites {edb.Function#_broadcast}
	 * @type {String}
	 */
	_broadcast : edb.BROADCAST_TAG_LOADED

});