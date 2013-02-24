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
	 * Required functions.
	 * @type {Map<String,String>}
	 */
	functions : null,

	/**
	 * Mapping script tag attributes.
	 * @type {HashMap<String,String>}
	 */
	directives : null,

	/**
	 * Construction.
	 * @param {String} source
	 * @param {Map<String,String} directives
	 */
	onconstruct : function ( source, directives ) {
		this.directives = directives || Object.create ( null );
		this.source = source;
	},
		
	/**
	 * Compile script to invocable function.
	 * @param {Window} scope Function to be declared in scope of this window (or worker context).
	 * @param @optional {boolean} fallback
	 * @returns {function}
	 */
	compile : function ( scope ) {
		var result = null;
		this.params = [];
		this.functions = Object.create ( null );
		this._vars = [];
		var head = {
			declarations : Object.create ( null ), // Map<String,boolean>
			definitions : [] // Array<String>
		};
		[ 
			"_validate", 
			"_extract", 
			"_direct", 
			"_declare", 
			"_define", 
			"_compile",
		].forEach ( function ( step ) {
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
	 * Resolve directives (tag declarations for now).
	 * @param  {String} script
	 */
	_direct : function ( script ) {
		if ( this.directives.tag ) {
			var content = /<content(.*)>(.*)<\/content>|<content(.*)(\/?)>/;
			this.params.push ( "__content__" );
			this.params.push ( "__attribs__" );
			script = "att = __attribs__;\n" + script;
			script = script.replace ( content, "__content__  ( out );" );
		}
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
			funcs.push ( name + " = __functions__ [ '" + name + "' ];\n" );
		}, this );
		if ( funcs [ 0 ]) {
			head.definitions.push ( 
				"( function lookup ( __functions__ ) {\n" +
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
		var html = "var out = new edb.Out (), att = new edb.Att ()" + vars +";\n";
		head.definitions.forEach ( function ( def ) {
			html += def +"\n";
		});
		return html + script;
	},

	/**
	 * Compile that script.
	 * @param {String} script
	 * @param {What?} head
	 * @returns {String}
	 */
	_compile : function ( script, head ) {
		var attr = edb.FunctionCompiler._ATTREXP;
		var body = '"use strict";\n',
			html = false,
			peek = false,
			poke = false,
			cont = false,
			adds = false,
			func = null,
			skip = 0,
			last = 0,
			spot = 0,
			indx = 0;
		/*
		 * Parse @ notation in markup. 
		 * @param {String} line
		 * @param {number} i
		 */
		function atthtml ( line, i ) {
			var rest, name, dels, what;
			if ( this._behind ( line, i, "@" )) {}
			else if ( this._ahead ( line, i, "@" )) {
				body += "' + att._all () + '";
				skip = 2;
			} else {
				rest = line.substring ( i + 1 );
				name = attr.exec ( rest )[ 0 ];
				dels = this._behind ( line, i, "-" );
				what = dels ? "att._pop" : "att._out";
				body = dels ? body.substring ( 0, body.length - 1 ) : body;
				body += "' + " + what + " ( '" + name + "' ) + '";
				skip = name.length + 1;
			}
		}
		/*
		 * Parse @ notation in script.
		 * TODO: preserve email address and allow same-line @
		 * @param {String} line
		 * @param {number} i
		 */
		function attscript ( line, i ) {
			var rest, name;
			if ( this._behind ( line, i, "@" )) {} 
			else if ( this._ahead ( line, i, "@" )) {
				body += "var att = new edb.Att ();";
				skip = 2;
			} else {
				rest = line.substring ( i + 1 );
				name = attr.exec ( rest )[ 0 ];
				if ( name ) {
					body += rest.replace ( name, "att['" + name + "']" );
					skip = rest.length;
				} else {
					throw "Bad @name: " + rest;
				}
			}
		}
		script.split ( "\n" ).forEach ( function ( line, index ) {
			line = line.trim ();
			last = line.length - 1;
			adds = line.charAt ( 0 ) === "+";
			cont = cont || ( html && adds );
			if ( line.length > 0 ) {
				if ( index > 0 ) {
					if ( html ) {	
						if ( !cont ) {
							body += "';\n";
							html = false;
						}
					} else {
						body += "\n";
					}
				}
				cont = false;
				Array.forEach ( line, function ( c, i ) {
					if ( html ) {
						switch ( c ) {
							case "{" :
								if ( peek || poke ) {}
								break;
							case "}" :
								if ( peek ) {
									peek = false;
									skip = 1;
									body += ") + '";
								}
								if ( poke ) {
									body = this._inject ( body, spot, func, indx++ );
									poke = false;
									func = null;
									skip = 1;
								}
								break;
							case "$" :
								if ( !peek && !poke && this._ahead ( line, i, "{" )) {
									peek = true;
									skip = 2;
									body += "' + (";
								}
								break;
							case "#" :
								if ( !peek && !poke && this._ahead ( line, i, "{" )) {
									poke = true;
									func = "";
									skip = 2;
								}
								break;
							case "+" :
								switch ( i ) {
									case 0 :
										skip = adds ? 1 : 0;
										break;
									case last :
										cont = true;
										skip = 1;
										break;
								}
								break;
							case "'" :
								if ( !peek && !poke ) {
									body += "\\";
								}
								break;
							case "@" :
								atthtml.call ( this, line, i );
								break;
						}
					} else {
						switch ( c ) {
							case "<" :
								if ( i === 0 ) {
									html = true;
									spot = body.length - 1;
									body += "out.html += '";
								}
								break;
							case "@" :
								attscript.call ( this, line, i );
								break;
						}
					}
					if ( skip-- <= 0 ) {
						if ( poke ) {
							func += c;
						} else {
							body += c;
						}
					}
				}, this );
			}
		}, this );
		body += ( html ? "';" : "" ) + "\nreturn out.write ();";
		return this._format ( body );
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
		this._debug ( this._format ( this.source ));
		this.source = "<p class=\"error\">" + exception.message + "</p>";
		return this.compile ( scope, true );
	},

	/**
	 * Transfer broken script source to script element and import on page.
	 * Hopefully this will allow the developer console to aid in debugging.
	 * TODO: Fallback for IE9 (see http://stackoverflow.com/questions/7405345/data-uri-scheme-and-internet-explorer-9-errors)
	 * TODO: Migrate this stuff to the gui.BlobLoader
	 * @param {String} source
	 */
	_debug : function ( source ) {
		if ( window.btoa ) {
			source = window.btoa ( "function debug () {\n" + source + "\n}" );
			var script = document.createElement ( "script" );
			script.src = "data:text/javascript;base64," + source;
			document.querySelector ( "head" ).appendChild ( script );
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
	
});

/**
 * @static
 * Test for nested scripts (because those are not parsable in the browser). 
 * http://stackoverflow.com/questions/1441463/how-to-get-regex-to-match-multiple-script-tags
 * http://stackoverflow.com/questions/1750567/regex-to-get-attributes-and-body-of-script-tags
 * TODO: stress test for no SRC attribute!
 * @type {RegExp}
 */
edb.FunctionCompiler._NESTEXP = /<script.*type=["']?text\/edbml["']?.*>([\s\S]+?)/g;

/**
 * @static
 * Matches a qualified attribute name (class,id,src,href) allowing 
 * underscores, dashes and dots while not starting with a number.
 * TODO: https://github.com/jshint/jshint/issues/383
 * @type {RegExp}
 */
edb.FunctionCompiler._ATTREXP = /^[^\d][a-zA-Z0-9-_\.]+/;