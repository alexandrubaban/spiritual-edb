/**
 * The ScriptPlugin shall render the spirits HTML.
 * @extends {gui.Plugin}
 * @using {gui.Arguments.confirmed}
 */
edb.ScriptPlugin = ( function using ( confirmed ) {

	return gui.Plugin.extend ({

		/**
		 * Script has been loaded?
		 * @type {boolean}
		 */
		loaded : false,

		/**
		 * Script has been run? Flipped after first run.
		 * @type {boolean}
		 */
		ran : false,

		/**
		 * Log development stuff to console?
		 * @type {boolean}
		 */
		debug : false,

		/**
		 * Hijacking the {edb.InputPlugin} which has been 
		 * designed to work without an associated spirit.
		 * @type {edb.InputPlugin}
		 */
		input : null,

		/**
		 * Construction time.
		 */
		onconstruct : function () {
			this._super.onconstruct ();
			this.inputs = this.inputs.bind ( this );
		},

		/**
		 * Destruction time.
		 */
		ondestruct : function () {
			this._super.ondestruct ();
			if ( this.loaded && this.input ) {
				this.input.ondestruct ();
			}
		},

		/**
		 * Load script.
		 * @param {function} script
		 */
		load : confirmed ( "function" ) ( function ( script ) {
			this.loaded = true;
			this._script = script;
			this._updater = new edb.UpdateManager ( this.spirit );
			this._process ( script.$instructions );
			if ( !this.input ) {
				this.run ();
			}
		}),

		/**
		 * Handle input.
		 * @param {edb.Input} input
		 */
		oninput : function ( input ) {
			if ( this.input.done ) {
				this.run ();
			}
		},

		/**
		 * Run script and write result to DOM.
		 */
		run : function ( /* arguments */ ) {
			if ( this.loaded ) {
				if ( this.spirit.life.entered ) {
					this.write ( this._run.apply ( this, arguments ));
				} else {
					this.spirit.life.add ( gui.LIFE_ENTER, this );
					this._arguments = arguments;
				}
			} else {
				console.error ( this.spirit, "No script loaded" );
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
					this._updater.update ( html );
				});
				this.spirit.onrender ({ // @TODO: some kind of RenderSummary...
					changed : changed,
					first : !this.ran
				});
			}
			this.ran = true;
		},

		/**
		 * Get input of type.
		 * @param {function} Type
		 * @returns {object}
		 */
		inputs : function ( Type ) {
			return this.input.get ( Type );
		},

		/**
		 * Handle broadcast.
		 * @param {gui.Broadcast} broadcast
		 */
		onbroadcast : function ( b ) {
			var keys = this._triggers;
			switch ( b.type ) {
				case edb.BROADCAST_ACCESS :
					keys [ b.data ] = true;
					break;
				case edb.BROADCAST_CHANGE :
					if ( keys [ b.data ]) {
						var tick = edb.TICK_SCRIPT_UPDATE;
						gui.Tick.one ( tick, this ).dispatch ( tick, 0 );	
					}
					break;
			}
		},

		/**
		 * Tick allows for multiple model updates to trigger a single rendering.
		 * @param {gui.Tick} tick
		 */
		ontick : function ( tick ) {
			switch ( tick.type ) {
				case edb.TICK_SCRIPT_UPDATE :
					this.run ();
					break;
			}
		},

		/**
		 * @param {gui.Life} life
		 */
		onlife : function ( l ) {
			if ( l.type === gui.LIFE_ENTER ) {
				this.spirit.life.remove ( l.type, this );
				if ( this._arguments ) {
					this.run.apply ( this, this._arguments );
				}
			}
		},


		// PRIVATES .......................................................

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

		/**
		 * Mapping keys broadcasted from edb.Objects to trigger repaint.
		 * @type {Map<String,boolean>} 
		 */
		_triggers : null,

		/**
		 * Cache arguments for postponed execution.
		 * @type {Arguments}
		 */
		_arguments : null,

		/**
		 * Snapshot latest HTML to avoid parsing duplicates.
		 * @type {String}
		 */
		_html : null,

		/**
		 * Parse processing instructions.
		 * @param {Array<object>} pis
		 */
		_process : function ( pis ) {
			if ( pis ) {
				var inputs = []; // batch multiple inputs to prevent early resolve
				pis.forEach ( function ( pi ) {
					switch ( pi.type ) {
						case "input" :
							inputs.push ( 
								gui.Object.lookup ( pi.atts.type )
							);
							break;
					}
				});
				if ( inputs.length ) {
					this.input = new edb.InputPlugin ();
					this.input.add ( inputs, this );
				}
			}
		},

		/**
		 * Add-remove broadcast handlers.
		 * @param {boolean} isBuilding
		 */
		_subscribe : function ( isBuilding ) {
			gui.Broadcast [ isBuilding ? "add" : "remove" ] ( edb.BROADCAST_ACCESS, this );
			gui.Broadcast [ isBuilding ? "remove" : "add" ] ( edb.BROADCAST_CHANGE, this );
		},

		/**
		 * Run the script while maintaining broadcast setup.
		 * @returns {String}
		 */
		_run : function ( /* arguments */ ) {
			this._triggers = {};
			this._subscribe ( true );
			var html = this._script.apply ( this.spirit, arguments );
			this._subscribe ( false );
			return html;
		},

		// @TODO: move below elsewhere ..................................................

		/**
		 * Preserve form field focus before and after action.
		 * @param {function} action
		 */
		_stayfocused : function ( action ) {
			var field, selector = edb.EDBModule.fieldselector;
			action.call ( this );
			if ( selector ) {
				field = gui.DOMPlugin.q ( this.spirit.document, selector );
				if ( field && "#" + field.id !== selector ) {
					if ( field && gui.DOMPlugin.contains ( this.spirit, field )) {
						field.focus ();
						var text = "textarea,input:not([type=checkbox]):not([type=radio])";
						if ( gui.CSSPlugin.matches ( field, text )) {
							field.setSelectionRange ( 
								field.value.length, 
								field.value.length 
							);
						}
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


	}, {}, { // Static .......................................................

		/**
		 * @TODO: STACK LOST ANYWAY!
		 * @type {String}
		 */
		_warning : "Spiritual: Form elements with a unique @id may be updated without losing the undo-redo stack (now gone)."

	});

}( gui.Arguments.confirmed ));