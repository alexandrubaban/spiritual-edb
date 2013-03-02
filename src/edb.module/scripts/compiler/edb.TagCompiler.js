/**
 * Tags are functions with boilerplate code.
 * @extends {edb.FunctionCompiler}
 */
edb.TagCompiler = edb.FunctionCompiler.extend ( "edb.TagCompiler", {

	/**
	 * We added the "tag" directive ourselves.
	 * @overloads {edb.FunctionCompiler._direct}
	 * @param  {String} script
	 * @returns {String}
	 */
	_direct : function ( script ) {
		if ( this.directives.tag ) {
			var content = edb.FunctionCompiler._CONTENT;
			this.params.push ( "content" );
			this.params.push ( "attribs" );
			script = "att = attribs;\n" + script;
			script = script.replace ( content, "content ( out );" );

		}
		return this._super._direct ( script );
	}

});