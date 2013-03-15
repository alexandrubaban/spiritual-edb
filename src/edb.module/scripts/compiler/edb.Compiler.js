/**
 * Core compiler methods.
 */
edb.Compiler = gui.Class.create ( Object.prototype, {

	/**
	 * Compile EDBML to function source.
	 * @param {String} script
	 * @param {What?} head
	 * @returns {String}
	 */
	_compile : function ( script, head ) {
		var state = new edb.State ( '"use strict";\n' );
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
			default : // @TODO case "js"
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
				this._htmlatt ( state, line, i );
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
						this._aaa ( state, line, i );
					} else if (( tag = this._tagstop ( line ))) {
						state.mode = "tag"; // js ??????????????????????????????????
						this._bbb ( state );
					} else {
						state.mode = "html";
						state.spot = state.body.length - 1;
						state.body += "out.html += '";
					}
				}
				break;
			case "@" :
				this._scriptatt ( state, line, i );
				break;
		}
	},

	_aaa : function ( state, line, i ) {
		state.body += "out.html += Tag.get ( '#ole', window )( function ( out ) {";
		var elem = new gui.HTMLParser ( document ).parse ( line + "</ole>" )[ 0 ];
		var json = JSON.stringify ( gui.AttPlugin.getmap ( elem ), null, "\t" );
		var atts = this._fixerupper ( json );
		state.conf.push ( atts );
	},

	_bbb : function ( state ) {
		state.body += "}, " + state.conf.pop () + ");";
		state.conf = null;
	},

	_fixerupper : function ( json ) {

		var state = new edb.State ();
		state.body = "";

		var lines = json.split ( "\n" );
		lines.forEach ( function ( line, index ) {
			Array.forEach ( line, function ( c, i ) {
				switch ( c ) {
					case "\"" :
						if ( !state.peek && !state.poke ) {
							if ( this._ahead ( line, i, "${" )) {
								state.peek = true;
								state.skip = 3;
							} else if ( this._ahead ( line, i, "#{" )) {
								state.poke = true;
								state.skip = 3;
								state.func = " function () {\n";
								state.spot = state.body.length - 1;
							}
						}
						break;
					case "}" :
						if ( state.peek || state.poke ) {
							if ( this._skipahead ( line, i, "\"" )) {
								if ( state.poke ) {
									state.func += "\n}";
									state.body = state.body.substring ( 0, state.spot ) + 
										state.func + state.body.substring ( state.spot );
								}
								state.peek = false;
								state.poke = false;
								state.skip = 2;
							}
						}
						break;
				}
				if ( state.skip-- <= 0 ) {
					if ( state.poke ) {
						state.func += c;
					} else {
						state.body += c;
					}
				}
			}, this );
			if ( index < lines.length - 1 ) {
				state.body += "\n";
			}
		}, this );
		return state.body; //.replace ( /"\${/g, "" ).replace ( /\}"/g, "" );
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
			case "$" :
				if ( this._ahead ( line, i, "{" )) {
					state.refs = true;
					state.skip = 2;
				}
				break;
			case ">" :
				//state.tagt = false;
				state.mode = "js";
				state.skip = 1;
				break;
		}
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
	 * Space-stripped text at index equals string?
	 * @param {String} line
	 * @param {number} index
	 * @param {String} string
	 * @returns {boolean}
	 */
	_skipahead : function ( line, index, string ) {
		line = line.substr ( index ).replace ( / /g, "" );
		return this._ahead ( line, 0, string );
	},

	/**
	 * @TODO
	 * Space-stripped text before index equals string?
	 * @param {String} line
	 * @param {number} index
	 * @param {String} string
	 * @returns {boolean}
	 *
	_skipbehind : function ( line, index, string ) {
		return this._behind ( line.replace ( / /g, "" ), index, string );
	},
	*/

	/**
	 * Tag start?
	 * @param {String} line
	 */
	_tagstart : function ( line ) {
		return this._ahead ( line, 0, "ole" );
	},

	/**
	 * Tag stop?
	 * @param {String} line
	 */
	_tagstop : function ( line ) {
		return this._ahead ( line, 0, "/ole>" );
	},

	/*
	 * Parse @ notation in markup. 
	 * @param {String} line
	 * @param {number} i
	 */
	_htmlatt : function ( state, line, i ) {
		var attr = edb.Compiler._ATTREXP;
		var rest, name, dels, what;
		if ( this._behind ( line, i, "@" )) {}
		else if ( this._behind ( line, i, "#{" )) {} // @TODO onclick="#{@passed}" ???
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
	 * Parse @ notation in script.Ptag
	 * TODO: preserve email address and allow same-line @
	 * @param {String} line
	 * @param {number} i
	 */
	_scriptatt : function ( state, line, i ) {
		var attr = edb.Compiler._ATTREXP;
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
	 * Format script output.
	 * @TODO Indent switch cases
	 * @TODO Remove blank lines
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
	 * Matches a qualified attribute name (class,id,src,href) allowing 
	 * underscores, dashes and dots while not starting with a number.
	 * @TODO https://github.com/jshint/jshint/issues/383
	 * @type {RegExp}
	 */
	_ATTREXP : /^[^\d][a-zA-Z0-9-_\.]+/

});