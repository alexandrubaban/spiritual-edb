/**
 * The ScriptPlugin shall render the spirits HTML.
 * @extends {gui.Plugin} (should perhaps extend some kind of genericscriptplugin)
 */
edb.ScriptPlugin = gui.Plugin.extend ( "edb.ScriptPlugin", {

	/**
	 * Script has been loaded and compiled?
	 * @type {boolean}
	 */
	loaded : false,

	/**
	 * Automatically run the script on spirit.onenter()? 
	 * @TODO implement 'required' attribute on params instead...
	 *
	 * - any added <?param?> value will be undefined at this point
	 * - adding <?input?> will delay run until all input is loaded
	 * @type {boolean}
	 */
	autorun : true,

	/**
	 * Script has been run? Flipped after first run.
	 * @type {boolean}
	 */
	ran : false,

	/**
	 * Use minimal updates (let's explain exactly what this is)?
	 * If false, we write the entire HTML subtree on all updates. 
	 * @type {boolean}
	 */
	diff : true,

	/**
	 * Log development stuff to console?
	 * @type {boolean}
	 */
	debug : false,

	/**
	 * Hm...
	 * @type {Map<String,object>}
	 */
	extras : null,

	/**
	 * Script SRC. Perhaps this should be implemented as a method.
	 * @type {String}
	 */
	src : {
		getter : function () {
			return this._src;
		},
		setter : function ( src ) {
			this.load ( src );
		}
	},
	
	/**
	 * Construction time.
	 *
	 * 1. don't autorun service scripts
	 * 2. use minimal updating system?
	 * 3. import script on startup 
	 */
	onconstruct : function () {
		this._super.onconstruct ();
		var spirit = this.spirit;
		this.inputs = this.inputs.bind ( this );
		spirit.life.add ( gui.LIFE_DESTRUCT, this );
		if ( spirit instanceof edb.ScriptSpirit ) {
			this.autorun = false;
		} else if ( this.diff ) {
			this._updater = new edb.UpdateManager ( spirit );
		}
	},

	/**
	 * Destruction time.
	 */
	ondestruct : function () {
		this._super.ondestruct ();
		if ( this._script ) {
			this._script.dispose ();
		}
	},

	/**
	 * Handle attribute update.
	 * @param {gui.Att} att
	 */
	onatt : function ( att ) {
		if ( att.name === "src" ) {
			this.src = att.value;
		}
	},

	/**
	 * If in an iframe, now is the time to fit the iframe 
	 * to potential new content (emulating seamless iframes).
	 * @TODO: at least make sure IframeSpirit consumes this if not set to fit
	 * @param {gui.Tick} tick
	 */
	ontick : function ( tick ) {
		if ( tick.type === gui.TICK_DOC_FIT ) {
			this.spirit.action.dispatchGlobal ( gui.ACTION_DOC_FIT );
		}
	},
	
	/**
	 * @TODO: The issue here is that the {ui.UpdateManager} can't diff propertly unless we 
	 * wait for enter because it looks up the spirit via {gui.Spiritual#_spirits.inside}...
	 * @param {gui.Life} life
	 */
	onlife : function ( life ) {
		if ( life.type ===  gui.LIFE_ENTER ) {
			this.spirit.life.remove ( life.type, this );
			if ( this._dosrc ) {
				this.load ( this._dosrc );
				this._dosrc = null;
			}
		}
	},

	/**
	 * Load script from SRC. This happens async unless the SRC 
	 * points to a script embedded in the spirits own document 
	 * (and unless script has already been loaded into context).
	 * @param {String} src (directives resolved on target SCRIPT)
	 */
	load : function ( src ) {
		var win = this.context;
		var doc = win.document;
		var abs = gui.URL.absolute ( doc, src );
		if ( this.spirit.life.entered ) {
			if ( abs !== this._src ) {
				edb.Script.load ( win, doc, src, function onreadystatechange ( script ) {
					this._onreadystatechange ( script );
				}, this );
				this._src = abs;
			}
		} else { // {edb.UpdateManager} needs to diff
			this.spirit.life.add ( gui.LIFE_ENTER, this );
			this._dosrc = src;
		}
	},

	/**
	 * Compile script from source TEXT and run it when ready.
	 * @param {String} source Script source code
	 * @param @optional {HashMap<String,object>} directives Optional compiler directives
	 */
	compile : function ( source, directives ) {
		var win = this.context, url = new gui.URL ( this.context.document );
		edb.Script.compile ( win, url, source, directives, function onreadystatechange ( script ) {
			this._onreadystatechange ( script );
		}, this );
	},

	/**
	 * Run script (with implicit arguments) and write result to DOM.
	 * @see {gui.SandBoxView#render}
	 */
	run : function ( /* arguments */ ) {
		if ( this.loaded ) {
			this._script.pointer = this.spirit; // TODO!
			this.write ( 
				this._script.execute.apply ( 
					this._script, 
					arguments 
				)	
			);
		} else {
			this._dorun = arguments;
		}
	},
	
	/**
	 * Write the actual HTML to screen. You should probably only 
	 * call this method if you are producing your own markup 
	 * somehow, ie. not using EDBML templates out of the box. 
	 * @param {String} html
	 */
	write : function ( html ) {
		var changed = this._html !== html;
		if ( changed ) {
			this._html = html;
			this._stayfocused ( function () {
				if ( this.diff ) {
					this._updater.update ( html );
				} else {
					this.spirit.dom.html ( html ); // TODO: forms markup make valid!
				}
			});
			this.ran = true;
			this.spirit.life.dispatch ( 
				edb.LIFE_SCRIPT_DID_RUN, changed // @TODO Support this kind of arg...
			);
			if ( this.context.gui.hosted ) { // fit any containing iframe in next tick.
				var tick = gui.TICK_DOC_FIT;
				var id = this.context.gui.$contextid;
				gui.Tick.one ( tick, this, id ).dispatch ( tick, 0, id );
			}
		}
	},

	/**
	 * Private input.
	 * @param {object} data JSON object or array (demands arg 2) or an edb.Type instance (omit arg 2).
	 * @param @optional {function|String} type edb.Type constructor or "my.ns.MyType"
	 */
	input : function ( data, Type ) {
		var input = edb.Input.format ( this.context, data, Type );
		if ( this._script ) {
			this._script.input.match ( input );
		} else {
			this._doinput = this._doinput || [];
			this._doinput.push ( input );
		}
	},

	/**
	 * Return data for input of type.
	 * @param {function} type
	 * @returns {object}
	 */
	inputs : function ( type ) {
		return this._script.input.get ( type );
	},


	// PRIVATES ...........................................................................

	/**
	 * Script SRC.
	 * @type {String}
	 */
	_src : null,

	/**
	 * Script thing.
	 * @type {edb.Script}
	 */
	_script : null,

	/**
	 * Update manager. 
	 * @type {edb.UpdateManager}
	 */
	_updater : null,

	/*
	 * Listing private input to be injected into script once loaded.
	 * @type {Array<edb.Input>}
	 */
	_doinput : null,

	/**
	 * @type {String}
	 */
	_dosrc : null,

	/**
	 * Run arguments on script loaded.
	 * @type {Arguments}
	 */
	_dorun : null,

	/**
	 * Snapshot latest HTML to avoid parsing duplicates.
	 * @type {String}
	 */
	_html : null,

	/**
	 * Handle script state change.
	 * @param {edb.Script} script
	 */
	_onreadystatechange : function ( script ) {
		this._script = this._script || script;
		switch ( script.readyState ) {
			case edb.Function.WAITING :
				if ( this._doinput ) {
					while ( this._doinput.length ) {
						this.input ( this._doinput.shift ());
					}
					this._doinput = null;
				}
				break;
			case edb.Function.READY :
				if ( !this.loaded ) {
					this.loaded = true;
					if ( this.debug ) {
						script.debug ();
					}
				}
				if ( this._dorun ) {
					this.run.apply ( this, this._dorun );
					this._dorun = null;
				} else if ( this.autorun ) {
					this.run (); // @TODO: only if an when entered!
				}
				break;
		}
	},

	/**
	 * Preserve form field focus before and after action.
	 * @param {function} action
	 */
	_stayfocused : function ( action ) {
		var field, selector = edb.EDBModule.fieldselector;
		action.call ( this );
		if ( selector ) {
			field = gui.DOMPlugin.q ( this.spirit.document, selector );
			if ( field && field.id !== "#" + selector ) {
				if ( field && gui.DOMPlugin.contains ( this.spirit, field )) {
					this._restorefocus ( field );
					this._debugwarning ();
				}
			}
		}
	},

	/**
	 * Focus form field.
	 * @param {Element} field
	 */
	_restorefocus : function ( field ) {
		var text = "textarea,input:not([type=checkbox]):not([type=radio])";
		field.focus ();
		if ( gui.CSSPlugin.matches ( field, text )) {
			field.setSelectionRange ( 
				field.value.length, 
				field.value.length 
			);
		}
	},

	/**
	 * We're only gonna say this once.
	 */
	_debugwarning : function () {
		var This = edb.ScriptPlugin;
		if ( This._warning && this.spirit.window.gui.debug ) {
			console.debug ( This._warning );
			This._warning = null;
		}
	}

}, { // Static .......................................................

	/**
	 * TODO: STACK LOST ANYWAY!
	 * @type {String}
	 */
	_warning : "Spiritual: Form elements with a unique @id may be updated without losing the undo-redo stack (now gone)."

});