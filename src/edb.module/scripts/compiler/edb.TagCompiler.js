/**
 * Compile function as tag. Tags are functions with boilerplate code.
 * @extends {edb.FunctionCompiler}
 */
edb.TagCompiler = edb.FunctionCompiler.extend ( "edb.TagCompiler", {

	/**
	 * We added the "tag" directive ourselves.
	 * @overrides {edb.FunctionCompiler._direct}
	 * @param  {String} script
	 * @returns {String}
	 */
	_direct : function ( script ) {
		if ( this.directives.tag ) {
			var content = edb.TagCompiler._CONTENT;
			this._params.push ( "content" );
			this._params.push ( "attribs" );
			this._params.push ( "COMPILED_AS_TAG" );
			script = "att = new Att ( attribs );\n" + script;
			script = script.replace ( content, "content ( out );" );

		}
		return this._super._direct ( script );
	}


}, {}, { // Static .................................................

	/**
	 * Match <content/> tag in whatever awkward form.
	 * @type {RegExp}
	 */
	_CONTENT : /<content(.*)>(.*)<\/content>|<content(.*)(\/?)>/

});