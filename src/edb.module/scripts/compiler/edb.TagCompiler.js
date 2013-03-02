/**
 * Add support for data types.
 * @extends {edb.FunctionCompiler}
 */
edb.TagCompiler = edb.FunctionCompiler.extend ({

	/**
	 * Adding the "tag" directive.
	 * @overloads {edb.Template#compile}
	 * @param {String} source
	 * @param {HashMap<String,String>} directives
	 * @returns {edb.Function}
	 *
	compile : function ( source, directives ) {
		directives = gui.Object.extend ( directives || {}, { tag : true });
		return this._super.compile ( source, directives );
	},

	/**
	 * We added the "tag" directive.
	 * @overloads {edb.FunctionCompiler._direct}
	 * @param  {String} script
	 * @returns {String}
	 *
	_direct : function ( script ) {
		script = this._super._direct ( script );
		if ( this.directives.tag ) {
			var content = edb.FunctionCompiler.CONTENT;
			this.params.push ( "content" );
			this.params.push ( "attribs" );
			script = "att = attribs;\n" + script;
			script = script.replace ( content, "content ( out );" );
		}
		return script;
	}
	*/

});