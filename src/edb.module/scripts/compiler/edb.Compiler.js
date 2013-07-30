/**
 * Core compiler business logic. This is where we parse the strings.
 */
edb.Compiler = gui.Class.create ( "edb.Compiler", Object.prototype, {

	/**
	 * Line begins.
	 * @param {String} line
	 * @param {edb.Runner} runner
	 * @param {edb.Status} status
	 * @param {edb.Result} result
	 */
	newline : function ( line, runner, status, result ) {
		status.last = line.length - 1;
		status.adds = line [ 0 ] === "+";
		status.cont = status.cont || ( status.ishtml () && status.adds );
	},

	/**
	 * Line ends.
	 * @param {String} line
	 * @param {edb.Runner} runner
	 * @param {edb.Status} status
	 * @param {edb.Result} result
	 */
	endline : function  ( line, runner, status, result ) {
		if ( status.ishtml ()) {
			if ( !status.cont ) {
				result.body += "';\n";
				status.gojs ();
			}
		} else {
			result.body += "\n";
		}
		status.cont = false;
	},

	/**
	 * Next char.
	 * @param {String} c
	 * @param {edb.Runner} runner
	 * @param {edb.Status} status
	 * @param {edb.Result} result
	 */
	nextchar : function ( c, runner, status, result ) {
		switch ( status.mode ) {
			case edb.Status.MODE_JS :
				this._compilejs ( c, runner, status, result );
				break;
			case edb.Status.MODE_HTML :
				this._compilehtml ( c, runner, status, result);
				break;
			case edb.Status.MODE_TAG :
				this._compiletag ( c, runner, status, result );
				break;
		}
		if ( status.skip-- <= 0 ) {
			if ( status.poke ) {
				result.temp += c;
			} else {
				if ( !status.istag ()) {
					result.body += c;
				}
			}
		}
	},


	// Private .....................................................
	
	/**
	 * Compile EDBML source to function body.
	 * @param {String} script
	 * @returns {String}
	 */
	_compile : function ( script ) {
		var runner = new edb.Runner (); 
		var status = new edb.Status ();
		var result = new edb.Result ( '"use strict";\n' );
		runner.run ( this, script, status, result );
		result.body += ( status.ishtml () ? "';" : "" ) + "\nreturn out.write ();";
		return result.format ();
	},

	/**
	 * Compile character as script.
	 * @param {String} c
	 * @param {edb.Runner} runner
	 * @param {edb.Status} status
	 * @param {edb.Result} result
	 */
	_compilejs : function ( c, runner, status, result ) {
		switch ( c ) {
			case "<" :
				if ( runner.firstchar ) {
					var line = "JSHINT";
					var i = "JSHINT";
					var tag;
					if ( false && ( tag = this._tagstart ( line ))) {
						status.gotag ();
						this._aaa ( status, line, i );
					} else if ( false && ( tag = this._tagstop ( line ))) {
						status.gotag (); // js?
						this._bbb ( status );
					} else {
						status.gohtml ();
						status.spot = result.body.length - 1;
						result.body += "out.html += '";
					}
				}
				break;
			case "@" :
				this._scriptatt ( runner, status, result );
				break;
		}
	},
	
	/**
	 * Compile character as HTML.
	 * @param {String} c
	 * @param {edb.Runner} runner
	 * @param {edb.Status} status
	 * @param {edb.Result} result
	 */
	_compilehtml : function ( c, runner, status, result ) {
		switch ( c ) {
			case "{" :
				if ( status.peek || status.poke ) {
					status.curl ++;
				}
				break;
			case "}" :
				if ( -- status.curl === 0 ) {
					if ( status.peek ) {
						status.peek = false;
						status.skip = 1;
						status.curl = 0;
						result.body += ") + '";
					}
					if ( status.poke ) {
						this._poke ( status, result );
						status.poke = false;
						result.temp = null;
						status.spot = -1;
						status.skip = 1;
						status.curl = 0;
					}
				}
				break;
			case "$" :
				if ( !status.peek && !status.poke && runner.ahead ( "{" )) {
					status.peek = true;
					status.skip = 2;
					status.curl = 0;
					result.body += "' + (";
				}
				break;
			case "#" :
				if ( !status.peek && !status.poke && runner.ahead ( "{" )) {
					status.poke = true;
					status.skip = 2;
					status.curl = 0;
					result.temp = "";
				}
				break;
			case "+" :
				if ( runner.firstchar ) {
					status.skip = status.adds ? 1 : 0;
				} else if ( runner.lastchar ) {
					status.cont = true;
					status.skip = 1;
				}
				break;
			case "'" :
				if ( !status.peek && !status.poke ) {
					result.body += "\\";
				}
				break;
			case "@" :
				this._htmlatt ( runner, status, result );
				break;
		}
	},

	/**
	 * Compile character as tag.
	 * @param {String} c
	 * @param {edb.Runner} runner
	 * @param {edb.Status} status
	 * @param {edb.Result} result
	 */
	_compiletag : function ( status, c, i, line ) {
		switch ( c ) {
			case "$" :
				if ( this._ahead ( line, i, "{" )) {
					status.refs = true;
					status.skip = 2;
				}
				break;
			case ">" :
				status.gojs ();
				status.skip = 1;
				break;
		}
	},

	/*
	 * Parse @ notation in JS.
	 * TODO: preserve email address and allow same-line @
	 * @param {String} line
	 * @param {number} i
	 */
	_scriptatt : function ( runner, status, result ) {
		var attr = edb.Compiler._ATTREXP;
		var rest, name;
		if ( runner.behind ( "@" )) {} 
		else if ( runner.ahead ( "@" )) {
			result.body += "var att = new edb.Att ();";
			status.skip = 2;
		} else {
			rest = runner.lineahead ();
			name = attr.exec ( rest )[ 0 ];
			if ( name ) {
				result.body += rest.replace ( name, "att['" + name + "']" );
				status.skip = rest.length;
			} else {
				throw "Bad @name: " + rest;
			}
		}
	},

	/*
	 * Parse @ notation in HTML.
	 * @param {String} line
	 * @param {number} i
	 */
	_htmlatt : function ( runner, status, result ) {
		var attr = edb.Compiler._ATTREXP;
		var rest, name, dels, what;
		if ( runner.behind ( "@" )) {}
		else if ( runner.behind ( "#{" )) { console.error ( "todo" );} // onclick="#{@passed}"
		else if ( runner.ahead ( "@" )) {
			result.body += "' + att._all () + '";
			status.skip = 2;
		} else {
			rest = runner.lineahead ();
			name = attr.exec ( rest )[ 0 ];
			dels = runner.behind ( "-" );
			what = dels ? "att._pop" : "att._out";
			result.body = dels ? result.body.substring ( 0, result.body.length - 1 ) : result.body;
			result.body += "' + " + what + " ( '" + name + "' ) + '";
			status.skip = name.length + 1;
		}
	},

	/**
	 * Generate poke at marked spot.
	 */
	_poke : function ( status, result ) {
		var sig = this._$contextid ? ( ", &quot;" + this._$contextid + "&quot;" ) : "";
		var body = result.body,
			temp = result.temp,
			spot = status.spot,
			prev = body.substring ( 0, spot ),
			next = body.substring ( spot ),
			name = gui.KeyMaster.generateKey ( "poke" );
		result.body = prev + "\n" + 
			"var " + name + " = edb.set ( function ( value, checked ) { \n" +
			temp + ";\n}, this );" + next +
			//"edb.Script.register ( event ).invoke ( &quot;\' + " + name + " + \'&quot;" + sig + " );";
			"edb.go(event,&quot;\' + " + name + " + \'&quot;" + sig + ");";
	}
	

	// TAGS .....................................................................

	/**
	 * Tag start?
	 * @param {String} line
	 *
	_tagstart : function ( line ) {
		return this._ahead ( line, 0, "ole" );
	},

	/**
	 * Tag stop?
	 * @param {String} line
	 *
	_tagstop : function ( line ) {
		return this._ahead ( line, 0, "/ole>" );
	},
	
	_aaa : function ( status, line, i ) {
		result.body += "out.html += Tag.get ( '#ole', window )( function ( out ) {";
		var elem = new gui.HTMLParser ( document ).parse ( line + "</ole>" )[ 0 ];
		var json = JSON.stringify ( gui.AttPlugin.getmap ( elem ), null, "\t" );
		var atts = this._fixerupper ( json );
		status.conf.push ( atts );
	},

	_bbb : function ( status ) {
		result.body += "}, " + status.conf.pop () + ");";
		status.conf = null;
	},

	_fixerupper : function ( json ) {

		var status = new edb.State ();
		result.body = "";


		var lines = json.split ( "\n" );
		lines.forEach ( function ( line, index ) {
			Array.forEach ( line, function ( c, i ) {
				switch ( c ) {
					case "\"" :
						if ( !status.peek && !status.poke ) {
							if ( this._ahead ( line, i, "${" )) {
								status.peek = true;
								status.skip = 3;
							} else if ( this._ahead ( line, i, "#{" )) {
								status.poke = true;
								status.skip = 3;
								result.temp = " function () {\n";
								status.spot = result.body.length - 1;
							}
						}
						break;
					case "}" :
						if ( status.peek || status.poke ) {
							if ( this._skipahead ( line, i, "\"" )) {
								if ( status.poke ) {
									result.temp += "\n}";
									result.body = result.body.substring ( 0, status.spot ) + 
									result.temp + result.body.substring ( status.spot );
								}
								status.peek = false;
								status.poke = false;
								status.skip = 2;
							}
						}
						break;
				}
				if ( status.skip-- <= 0 ) {
					if ( status.poke ) {
						result.temp += c;
					} else {
						result.body += c;
					}
				}
			}, this );
			if ( index < lines.length - 1 ) {
				result.body += "\n";
			}
		}, this );
		return result.body; //.replace ( /"\${/g, "" ).replace ( /\}"/g, "" );
	}
	*/


}, {}, { // Static ............................................................................

	/**
	 * Matches a qualified attribute name (class,id,src,href) allowing 
	 * underscores, dashes and dots while not starting with a number. 
	 * @TODO class and id may start with a number nowadays
	 * @TODO https://github.com/jshint/jshint/issues/383
	 * @type {RegExp}
	 */
	_ATTREXP : /^[^\d][a-zA-Z0-9-_\.]+/

});