/**
 * Compile EDB function.
 */
edb.FunctionCompiler = gui.Exemplar.create ( Object.prototype, {

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
	 * Required functions. Mapping src to variable name.
	 * @type {Map<String,String>}
	 */
	functions : null,

	/**
	 * Required tags. Mapping src to variable name.
	 * @type {Map<String,String>}
	 */
	tags : null,

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
			"_compile",
		];
	},
		
	/**
	 * Compile EDBML to invocable function.
	 * @param {Window} scope Function to be declared in scope of this window (or worker context).
	 * @param @optional {boolean} fallback
	 * @returns {function}
	 */
	compile : function ( scope ) {
		var result = null;
		this.params = [];
		this.tags = Object.create ( null );
		this.functions = Object.create ( null );
		this._vars = [];
		var head = {
			declarations : Object.create ( null ), // Map<String,boolean>
			definitions : [] // Array<String>
		};
		this.sequence.forEach ( function ( step ) {
			this.source = this [ step ] ( this.source, head );
		}, this );
		try {
			result = this._convert ( scope, this.source, this.params );
			this.source = this._source ( this.source, this.params );
		} catch ( exception ) {
			result = this._fail ( scope, exception );
		}
		return result;
	},

	/**
	 * Sign generated methods with a gui.signature key. This allows us to evaluate assigned 
	 * functions in a context different to where the template HTML is used (sandbox scenario).
	 * @param {String} signature
	 * @returns {edb.ScriptCompiler}
	 */
	sign : function ( signature ) {
		this._signature = signature;
		return this;
	},
	

	// PRIVATE ..............................................................................
	
	/**
	 * (Optionally) stamp a signature into edb.ScriptCompiler.invoke() callbacks.
	 * @type {String} 
	 */
	_signature : null,

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
		var atts = pi.atts;
		switch ( pi.type ) {
			case "param" :
				this.params.push ( atts.name );
				break;
			case "function" :
				this.functions [ atts.name ] = atts.src;
				break;
			case "tag" :
				var name = atts.src.split ( "#" )[ 1 ];
				if ( name ) {
					this.tags [ name ] = atts.src;
				} else {
					throw new Error ( "Missing #identifier: " + src );
				}
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
		gui.Object.each ( this.functions, function ( name, func ) {
			head.declarations [ name ] = true;
			funcs.push ( name + " = functions [ '" + name + "' ];\n" );
		}, this );
		if ( funcs [ 0 ]) {
			head.definitions.push ( 
				"( function lookup ( functions ) {\n" +
				funcs.join ( "" ) +
				"})( this.script.functions ());" 
			);
		}
		return script;
	},

	/**
	 * Define more stuff in head.
	 * @param {String} script
	 * @param {What?} head
	 * @returns {String}
	 */
	_define : function ( script, head ) {
		var vars = "";
		Object.keys ( head.declarations ).forEach ( function ( name ) {
			vars += ", " + name + " = null";
		});
		var html = "var Out = edb.Out, Att = edb.Att, Tag = edb.Tag, out = new Out (), att = new Att ()" + vars +";\n";
		head.definitions.forEach ( function ( def ) {
			html += def +"\n";
		});
		return html + script;
	},

	/**
	 * Compile EDBML to function source.
	 * @param {String} script
	 * @param {What?} head
	 * @returns {String}
	 */
	_compile : function ( script, head ) {
		var state = new edb.State ();
		script.split ( "\n" ).forEach ( function ( line, index ) {
			this._compileline ( state, line, index );
		}, this );
		state.body += ( state.mode === "html" ? "';" : "" ) + "\nreturn out.write ();";
		return this._format ( state.body );
	},

	/**
	 * Compile single line.
	 * @param {edb.State} state
	 * @param {String} line
	 * @param {number} index
	 */
	_compileline : function ( state, line, index ) {
		line = line.trim (); // beware of whitespace sensitive language
		state.last = line.length - 1;
		state.adds = line.charAt ( 0 ) === "+";
		state.cont = state.cont || ( state.mode === "html" && state.adds );
		if ( line.length > 0 ) {
			if ( index > 0 ) {
				if ( state.mode === "html" ) {	
					if ( !state.cont ) {
						state.body += "';\n";
						state.mode = "js";
					}
				} else {
					state.body += "\n";
				}
			}
			state.cont = false;
			Array.forEach ( line, function ( c, i ) {
				this._compilechar ( state, c, i, line );
			}, this );
		}
	},

	/**
	 * Compile single character.
	 * @param {edb.State} state
	 * @param {String} c
	 * @param {number} i
	 * @param {String} line
	 */
	_compilechar : function ( state, c, i, line ) {
		switch ( state.mode ) {
			case "tag" :
				this._compiletag ( state, c, i, line );
				break;
			case "html" :
				this._compilehtml ( state, c, i, line );
				break;
			default : // @todo case "js"
				this._compilescript ( state, c, i, line );
				break;
		}
		if ( state.skip-- <= 0 ) {
			if ( state.poke ) {
				state.func += c;
			} else {
				if ( state.mode !== "tag" ) {
					state.body += c;
				}
			}
		}
	},

	/**
	 * Compile character as HTML.
	 * @param {edb.State} state
	 * @param {String} c
	 * @param {number} i
	 * @param {String} line
	 */
	_compilehtml : function ( state, c, i, line ) {
		switch ( c ) {
			case "{" :
				if ( state.peek || state.poke ) {}
				break;
			case "}" :
				if ( state.peek ) {
					state.peek = false;
					state.skip = 1;
					state.body += ") + '";
				}
				if ( state.poke ) {
					state.body = this._inject ( state.body, state.spot, state.func, state.indx++ );
					state.poke = false;
					state.func = null;
					state.skip = 1;
				}
				break;
			case "$" :
				if ( !state.peek && !state.poke && this._ahead ( line, i, "{" )) {
					state.peek = true;
					state.skip = 2;
					state.body += "' + (";
				}
				break;
			case "#" :
				if ( !state.peek && !state.poke && this._ahead ( line, i, "{" )) {
					state.poke = true;
					state.func = "";
					state.skip = 2;
				}
				break;
			case "+" :
				switch ( i ) {
					case 0 :
						state.skip = state.adds ? 1 : 0;
						break;
					case state.last :
						state.cont = true;
						state.skip = 1;
						break;
				}
				break;
			case "'" :
				if ( !state.peek && !state.poke ) {
					state.body += "\\";
				}
				break;
			case "@" :
				this._atthtml ( state, line, i );
				break;
		}
	},

	/**
	 * Compile character as script.
	 * @param {edb.State} state
	 * @param {String} c
	 * @param {number} i
	 * @param {String} line
	 */
	_compilescript : function ( state, c, i, line ) {
		switch ( c ) {
			case "<" :
				if ( i === 0 ) {
					var tag;
					if (( tag = this._tagstart ( line ))) {
						state.mode = "tag";
						state.body += "out.html += Tag.get ( '#ole', window )( function ( out ) {";
						var elem = new gui.HTMLParser ( document ).parse ( line + "</ole>" )[ 0 ];
						var atts = JSON.stringify ( gui.AttPlugin.getmap ( elem ));
						state.conf.push ( atts );
					} else if (( tag = this._tagstop ( line ))) {
						state.body += "}, " + state.conf.pop () + " );";
						state.mode = "tag";
						state.conf = null;
					} else {
						state.mode = "html";
						state.spot = state.body.length - 1;
						state.body += "out.html += '";
					}
				}
				break;
			case "@" :
				this._attscript ( state, line, i );
				break;
		}
	},

	/**
	 * Compile character as tag.
	 * @param {edb.State} state
	 * @param {String} c
	 * @param {number} i
	 * @param {String} line
	 */
	_compiletag : function ( state, c, i, line ) {
		switch ( c ) {
			case ">" :
				//state.tagt = false;
				state.mode = "js";
				state.skip = 1;
				break;
		}
	},

	/*
	 * Parse @ notation in markup. 
	 * @param {String} line
	 * @param {number} i
	 */
	_atthtml : function ( state, line, i ) {
		var attr = edb.FunctionCompiler._ATTREXP;
		var rest, name, dels, what;
		if ( this._behind ( line, i, "@" )) {}
		else if ( this._ahead ( line, i, "@" )) {
			state.body += "' + att._all () + '";
			state.skip = 2;
		} else {
			rest = line.substring ( i + 1 );
			name = attr.exec ( rest )[ 0 ];
			dels = this._behind ( line, i, "-" );
			what = dels ? "att._pop" : "att._out";
			state.body = dels ? state.body.substring ( 0, state.body.length - 1 ) : state.body;
			state.body += "' + " + what + " ( '" + name + "' ) + '";
			state.skip = name.length + 1;
		}
	},

	/*
	 * Parse @ notation in script.
	 * TODO: preserve email address and allow same-line @
	 * @param {String} line
	 * @param {number} i
	 */
	_attscript : function ( state, line, i ) {
		var attr = edb.FunctionCompiler._ATTREXP;
		var rest, name;
		if ( this._behind ( line, i, "@" )) {} 
		else if ( this._ahead ( line, i, "@" )) {
			state.body += "var att = new edb.Att ();";
			state.skip = 2;
		} else {
			rest = line.substring ( i + 1 );
			name = attr.exec ( rest )[ 0 ];
			if ( name ) {
				state.body += rest.replace ( name, "att['" + name + "']" );
				state.skip = rest.length;
			} else {
				throw "Bad @name: " + rest;
			}
		}
	},

	_tagstart : function ( line ) {
		return this._ahead ( line, 0, "ole" );
	},

	_tagstop : function ( line ) {
		return this._ahead ( line, 0, "/ole>" );
	},

	/**
	 * Generate and inject poke function into main function body.
	 * @param {String} body
	 * @param {number} spot
	 * @param {String} func
	 * @returns {String}
	 */
	_inject : function ( body, spot, func, index ) {
		var sig = this._signature ?  ( ", &quot;" + this._signature + "&quot;" ) : "";
		return (
			body.substring ( 0, spot ) + "\n" + 
			"var __edb__" + index + " = edb.Script.assign ( function ( value, checked ) { \n" +
			func + ";\n" +
			"}, this );" +
			body.substring ( spot ) +
			"edb.Script.register ( event ).invoke ( &quot;\' + __edb__" + index + " + \'&quot;" + sig + " );"
		);
	},
	
	/**
	 * Evaluate script to invocable function.
	 * @param {Window} scope
	 * @param {String} script
	 * @param @optional (Array<String>} params
	 * @returns {function}
	 */
	_convert : function ( scope, script, params ) {
		var args = "";
		if ( gui.Type.isArray ( params )) {
			args = params.join ( "," );
		}
		return new scope.Function ( args, script );
	},
	
	/**
	 * Line text at index equals string?
	 * @param {String} line
	 * @param {number} index
	 * @param {String} string
	 * @returns {boolean}
	 */
	_ahead : function ( line, index, string ) {
		var i = index + 1, l = string.length;
		return line.length > index + l && line.substring ( i, i + l ) === string;
	},

	/**
	 * Line text before index equals string?
	 * @param {String} line
	 * @param {number} index
	 * @param {String} string
	 * @returns {boolean}
	 */
	_behind : function ( line, index, string ) {
		var length = string.length, start = index - length;
		return start >= 0 && line.substr ( start, length ) === string;
	},

	/**
	 * Compilation failed. Output a fallback rendering.
	 * @param {Window} scope
	 * @param {Error} exception
	 * @returns {function}
	 */
	_fail : function ( scope, exception ) {
		if ( !this._failed ) {
			this._failed = true;
			this._debug ( scope, this._format ( this.source ));
			this.source = "<p class=\"error\">" + exception.message + "</p>";
			return this.compile ( scope, true );
		} else {
			throw ( exception );
		}
	},

	/**
	 * Transfer broken script source to script element and import on page.
	 * Hopefully this will allow the developer console to aid in debugging.
	 * TODO: Fallback for IE9 (see http://stackoverflow.com/questions/7405345/data-uri-scheme-and-internet-explorer-9-errors)
	 * TODO: Migrate this stuff to the gui.BlobLoader
	 * @param {Window} scope
	 * @param {String} source
	 */
	_debug : function ( scope, source ) {
		if ( window.btoa ) {
			source = scope.btoa ( "function debug () {\n" + source + "\n}" );
			var script = scope.document.createElement ( "script" );
			script.src = "data:text/javascript;base64," + source;
			scope.document.querySelector ( "head" ).appendChild ( script );
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
	},

	/**
	 * Format script output.
	 * @todo Investigate overhead
	 * @todo Indent switch cases
	 * @todo Remove blank lines
	 * @param {String} body
	 * @returns {String}
	 */
	_format : function ( body ) {
		var result = "",
			tabs = "\t",
			first = null,
			last = null,
			fixt = null,
			flast = null;
		body.split ( "\n" ).forEach ( function ( line ) {
			line = line.trim ();
			first = line.charAt ( 0 );
			last = line.charAt ( line.length - 1 );
			fixt = line.split ( "//" )[ 0 ].trim ();
			flast = fixt.charAt ( fixt.length - 1 );
			if (( first === "}" || first === "]" ) && tabs !== "" ) {				
				tabs = tabs.slice ( 0, -1 );
			}
			result += tabs + line + "\n";
			if ( last === "{" || last === "[" || flast === "{" || flast === "[" ) {
				tabs += "\t";
			}
		});
		return result;
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
	_NESTEXP : /<script.*type=["']?text\/edbml["']?.*>([\s\S]+?)/g,

	/**
	 * @static
	 * Matches a qualified attribute name (class,id,src,href) allowing 
	 * underscores, dashes and dots while not starting with a number.
	 * TODO: https://github.com/jshint/jshint/issues/383
	 * @type {RegExp}
	 */
	_ATTREXP : /^[^\d][a-zA-Z0-9-_\.]+/,

	/**
	 * Match <content/> tag in whatever awkward form.
	 * @type {RegExp}
	 */
	_CONTENT : /<content(.*)>(.*)<\/content>|<content(.*)(\/?)>/

});