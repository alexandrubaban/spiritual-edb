/**
 * Here it is.
 * @extends {edb.Function}
 */
edb.Tag = edb.Function.extend ({

	/**
	 * Get compiler implementation.
	 * @returns {function}
	 */
	_compiler : function () {
		return edb.TagCompiler;
	},

	/**
	 * Adding the "tag" directive.
	 * @overrides {edb.Template#compile}
	 * @param {String} source
	 * @param {HashMap<String,String>} directives
	 * @returns {edb.Function}
	 */
	compile : function ( source, directives ) {
		directives.tag = true;
		return this._super.compile ( source, directives );
	}

});