/**
 * Compile EDB function.
 * @TODO precompiler to strip out both JS comments and HTML comments.
 */
edb.FunctionCompiler = edb.Compiler.extend ( "edb.FunctionCompiler", {

	/**
	 * Compiled script source.
	 * @type {String}
	 */
	source : null,
	
	/**
	 * Arguments expected for compiled function. 
	 * @type {Array<String>}
	 */
	params : null,

	/**
	 * Required functions and tags. Mapping 
	 * variable name to dependency tracker.
	 * @type {Array<edb.Dependency>}
	 */
	dependencies : null,

	/**
	 * Mapping script tag attributes.
	 * @type {HashMap<String,String>}
	 */
	directives : null,

	/**
	 * Compile sequence.
	 * @type {Array<string>}
	 */
	sequence : null,

	/**
	 * Construction.
	 * @param {String} source
	 * @param {Map<String,String} directives
	 */
	onconstruct : function ( source, directives ) {
		this.directives = directives || Object.create ( null );
		this.source = source;
		this.sequence = [ 
			"_validate", 
			"_extract", 
			"_direct", 
			"_declare", 
			"_define", 
			"_compile"
		];
	},
		
	/**
	 * Compile EDBML to invocable function.
	 * @param {Window} context
	 * @param @optional {boolean} fallback
	 * @returns {function}
	 */
	compile : function ( context ) {
		var result = null;
		this.dependencies = [];
		this.params = [];
		this._context = context;
		this._vars = [];
		var head = {
			declarations : Object.create ( null ), // Map<String,boolean>
			functiondefs : [] // Array<String>
		};
		this.sequence.forEach ( function ( step ) {
			this.source = this [ step ] ( this.source, head );
		}, this );
		try {
			result = this._convert ( this.source, this.params );
			this.source = this._source ( this.source, this.params );
		} catch ( exception ) {
			result = this._fail ( exception );
		}
		return result;
	},

	/**
	 * Sign generated methods with a gui.$contextid key. This allows us to evaluate assigned 
	 * functions in a context different to where the template HTML is used (sandbox scenario).
	 * @param {String} $contextid
	 * @returns {edb.ScriptCompiler}
	 */
	sign : function ( $contextid ) {
		this._$contextid = $contextid;
		return this;
	},
	

	// PRIVATE ..............................................................................
	
	/**
	 * Function to be declared in this window (or worker scope).
	 * @type {Window}
	 */
	_context : null,

	/**
	 * (Optionally) stamp a $contextid into edb.ScriptCompiler.invoke() callbacks.
	 * @type {String} 
	 */
	_$contextid : null,

	/**
	 * Script processing intstructions.
	 * @type {Array<edb.Instruction>}
	 */
	_instructions : null,

	/**
	 * Did compilation fail just yet?
	 * @type {boolean}
	 */
	_failed : false,

	/**
	 * Confirm no nested EDBML scripts because it's not parsable in the browser.
	 * @see http://stackoverflow.com/a/6322601
	 * @param {String} script
	 * @param {What?} head
	 * @returns {String}
	 */
	_validate : function ( script ) {
		if ( edb.FunctionCompiler._NESTEXP.test ( script )) {
			throw "Nested EDBML dysfunction";
		}
		return script;
	},

	/**
	 * Handle directives. Nothing by default.
	 * @see {edb.TagCompiler._direct}
	 * @param  {String} script
	 * @returns {String}
	 */
	_direct : function ( script ) {
		return script;
	},
	
	/**
	 * Extract and evaluate processing instructions.
	 * @param {String} script
	 * @param {What?} head
	 * @returns {String}
	 */
	_extract : function ( script, head ) {
		edb.Instruction.from ( script ).forEach ( function ( pi ) {
			this._instruct ( pi );
		}, this );
		return edb.Instruction.clean ( script );
	},

	/**
	 * Evaluate processing instruction.
	 * @param {edb.Instruction} pi
	 */
	_instruct : function ( pi ) {
		var type = pi.type;
		var atts = pi.atts;
		var href = atts.src;
		var name = atts.name;
		var cont = this._context;
		switch ( type ) {
			case "param" :
				this.params.push ( name );
				break;
			case "function" :
			case "tag" :
				if ( type === edb.Dependency.TYPE_TAG ) {
					if ( href.contains ( "#" )) {
						name = href.split ( "#" )[ 1 ];
					} else {
						throw new Error ( "Missing tag #identifier: " + href );
					}
				}
				this.dependencies.push ( 
					new edb.Dependency ( 
						cont,
						type,
						name,
						href
					)
				);
				break;
		}
	},

	/**
	 * Remove processing instrutions and translate collected inputs to variable declarations.
	 * @param {String} script
	 * @param {What?} head
	 * @returns {String}
	 */
	_declare : function ( script, head ) {
		var funcs = [];
		this.dependencies.forEach ( function ( dep ) {
			head.declarations [ dep.name ] = true;
			funcs.push ( dep.name + " = functions ( self, '" + dep.href + "' );\n" );
		}, this );
		if ( funcs [ 0 ]) {
			head.functiondefs.push ( 
				"( function lookup ( functions ) {\n" +
				funcs.join ( "" ) +
				"}( edb.Function.get ));"
			);
		}
		return script;
	},

	/**
	 * Remove processing instrutions and translate collected inputs to variable declarations.
	 * @param {String} script
	 * @param {What?} head
	 * @returns {String}
	 *
	_declare : function ( script, head ) {
		var funcs = [];
		this.dependencies.forEach ( function ( dep ) {
			head.declarations [ dep.name ] = true;
			funcs.push ( dep.name + " = functions ( '" + dep.href + "' );\n" );
		}, this );
		if ( funcs [ 0 ]) {
			head.functiondefs.push ( 
				"if (!this.script ) { alert(this);}\n" +
				"( function lookup ( functions ) {\n" +
				funcs.join ( "" ) +
				"}( this.script.functions ));"
			);
		}
		return script;
	},
	*/

	/**
	 * Define more stuff in head.
	 * @param {String} script
	 * @param {What?} head
	 * @returns {String}
	 */
	_define : function ( script, head ) {
		var vars = "";
		Object.keys ( head.declarations ).forEach ( function ( name ) {
			vars += ", " + name;
		});
		var html = "var Out = edb.Out, Att = edb.Att, Tag = edb.Tag, out = new Out (), att = new Att ()" + vars +";\n";
		head.functiondefs.forEach ( function ( def ) {
			html += def +"\n";
		});
		return html + script;
	},
	
	/**
	 * Evaluate script to invocable function.
	 * @param {String} script
	 * @param @optional (Array<String>} params
	 * @returns {function}
	 */
	_convert : function ( script, params ) {
		var args = "", context = this._context;
		if ( gui.Type.isArray ( params )) {
			args = params.join ( "," );
		}
		return new context.Function ( args, script );
	},

	/**
	 * Compilation failed. Output a fallback rendering.
	 * @param {Error} exception
	 * @returns {function}
	 */
	_fail : function ( exception ) {
		var context = this._context;
		if ( !this._failed ) {
			this._failed = true;
			this._debug ( edb.Result.format ( this.source ));
			this.source = "<p class=\"error\">" + exception.message + "</p>";
			return this.compile ( context, true );
		} else {
			throw ( exception );
		}
	},
	
	/**
	 * Transfer broken script source to script element and import on page.
	 * Hopefully this will allow the developer console to aid in debugging.
	 * TODO: Fallback for IE9 (see http://stackoverflow.com/questions/7405345/data-uri-scheme-and-internet-explorer-9-errors)
	 * TODO: Migrate this stuff to the gui.BlobLoader
	 * @param {String} source
	 */
	_debug : function ( source ) {
		var context = this._context;
		if ( window.btoa ) {
			source = context.btoa ( "function debug () {\n" + source + "\n}" );
			var script = context.document.createElement ( "script" );
			script.src = "data:text/javascript;base64," + source;
			context.document.querySelector ( "head" ).appendChild ( script );
			script.onload = function () {
				this.parentNode.removeChild ( this );
			};
	  } else {
			// TODO: IE!
	  }
	},

	/**
	 * Compute full script source (including arguments) for debugging stuff.
	 * @returns {String}
	 */
	_source : function ( source, params ) {
		var lines = source.split ( "\n" ); lines.pop (); // empty line :/
		var args = params.length ? "( " + params.join ( ", " ) + " )" : "()";
		return "function " + args + " {\n" + lines.join ( "\n" ) + "\n}";
	}
	

}, {}, { // Static ............................................................................

	/**
	 * @static
	 * Test for nested scripts (because those are not parsable in the browser). 
	 * http://stackoverflow.com/questions/1441463/how-to-get-regex-to-match-multiple-script-tags
	 * http://stackoverflow.com/questions/1750567/regex-to-get-attributes-and-body-of-script-tags
	 * TODO: stress test for no SRC attribute!
	 * @type {RegExp}
	 */
	_NESTEXP : /<script.*type=["']?text\/edbml["']?.*>([\s\S]+?)/g

});