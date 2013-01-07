/**
 * Compile params-only ("functional") EDB script.
 */
edb.FunctionCompiler = gui.Exemplar.create ( Object.prototype, {

	/**
	 * Compiled script text.
	 * @type {String}
	 */
	script : null,
	
	/**
	 * Debug script text?
	 * @type {}
	 */
	debug : false,
	
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
	 * Construction.
	 * @param {String} script
	 * @param {boolean} debug
	 */
	onconstruct : function ( script, debug ) {

		this.script = script;
		this.debug = debug ? true : false;
	},
		
	/**
	 * Compile script to invocable function.
	 * @param {Window} scope Function to be declared in scope of this window (or worker context).
	 * @param @optional {boolean} fallback
	 * @returns {function}
	 */
	compile : function ( scope, fallback ) {
		
		var result = null;
		this.params = [];
		this.functions = Object.create ( null );
		this._vars = [];
		
		var head = {
			declarations : Object.create ( null ), // Map<String,boolean>
			definitions : [] // Array<String>
		};

		[ "_extract", "_declare", "_cornholio", "_compile" ].forEach ( function ( step ) {
			this.script = this [ step ] ( this.script, head );
		}, this );
		
		try {
			result = this._convert ( scope, this.script, this.params );
			if ( this.debug ) {
				console.log ( this.source ());
			}
		} catch ( exception ) {
			if ( !fallback ) {
				result = this._fail ( scope, exception );
			}
		}
		
		return result;
	},

	/**
	 * Get formatted source.
	 * @returns {String}
	 */
	source : function ( tabs ) {

		var source = this._format ( this.script );
		if ( tabs ) {
			source = tabs + source.replace ( /\n/g, "\n" + tabs );
		}
		return source;
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
	 * Extract and evaluate script instructions.
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
	 * Evaluate script instruction.
	 * @param {edb.Instruction} pi
	 */
	_instruct : function ( pi ) {

		var atts = pi.atts;
		switch ( pi.type ) {
			case "param" :
				this.params.push ( atts.name );
				break;
			case "script" :
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
				"})( this.view.script.functions );" 
			);
		}
		return script;
	},

	/**
	 * I am Cornholio.
	 * @param {String} script
	 * @param {What?} head
	 * @returns {String}
	 */
	_cornholio : function ( script, head ) {

		var vars = "";
		Object.keys ( head.declarations ).forEach ( function ( name ) {
			vars += ", " + name + " = null";
		});
		var html = "var out = new edb.Out () " + vars +";\n";
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
						}
					} else {
						if ( c === "<" ) {
							if ( i === 0 ) {
								html = true;
								spot = body.length - 1;
								body += "out.html += '";
							}
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
		
		body += ( html ? "';" : "" ) + "\nreturn out.toString ();";
		return this.debug ? this._format ( body ) : body;
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
			"edb.Script.log ( event ).invoke ( &quot;\' + __edb__" + index + " + \'&quot;" + sig + " );"
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
	 * Compilation failed. Output a fallback rendering.
	 * @param {Window} scope
	 * @param {Error} exception
	 * @returns {function}
	 */
	_fail : function ( scope, exception ) {
		
		this._debug ( this._format ( this.script ));
		this.script = "<p class=\"error\">" + exception.message + "</p>";
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
	 * Format script output for debugging, adding indentation.
	 * TODO: indent switch cases
	 * @param {String} body
	 * @returns {String}
	 */
	_format : function ( body ) {
		
		var debug = "",
			tabs = "",
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
			debug += tabs + line + "\n";
			if ( last === "{" || last === "[" || flast === "{" || flast === "[" ) {
				tabs += "\t";
			}
		});
		return debug;
	}

});