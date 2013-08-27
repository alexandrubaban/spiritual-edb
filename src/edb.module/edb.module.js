/*
 * Register module.
 */
edb.EDBModule = gui.module ( "edb", {
	
	/**
	 * CSS selector for currently focused form field.
	 * @TODO: Support links and buttons as well
	 * @TODO: Migrate to (future) EDBMLModule
	 * @type {String}
	 */
	fieldselector : null,

	/*
	 * Extending {gui.Spirit}
	 */
	mixins : {
		
		/**
		 * Handle input.
		 * @param {edb.Input} input
		 */
		oninput : function ( input ) {
			if ( input.data instanceof edb.State ) {
				if ( this._statesstarted ( input.type, input.data )) {
					gui.Spirit.$oninit ( this );
				}
			}
		},

		/**
		 * Optional State instance.
		 * @type {edb.Controller.State}
		 */
		_state : null,

		/**
		 * Optional SessionState instance.
		 * @type {edb.Controller.SessionState}
		 */
		_sessionstate : null,

		/**
		 * Optional LocalState instance.
		 * @type {edb.Controller.LocalState}
		 */
		_localstate : null,

		/**
		 * Fire up potential state models. Returns 
		 * `true` if any state models are declared.
		 * @returns {boolean}
		 */
		_startstates : function () {
			var State;

			// @TODO: don't use some here!!!
			return Object.keys ( gui.Spirit.$states ).some ( function ( state ) {
				if (( State = this.constructor [ state ])) {
					this._startstate ( State );
					return true;
				} else {
					return false;
				}
			}, this );
		},

		/**
		 * Output state model only when the first 
		 * instance of this spirit is constructed. 
		 * Attempt to restore the stage from storage.
		 * @param {function} State
		 */
		_startstate : function ( State ) {
			this.input.add ( State );
			if ( !State.out ( this.window )) {
				State.restore ( this.window ).then ( function ( state ) {
					state = state || new State ();
					state.$output ( this.window );
				}, this );
			}
		},

		/**
		 * Assign state instance to private property name. 
		 * Returns true when all expected states are done.
		 * @param {function} State constructor
		 * @param {edb.State} state instance
		 * @returns {boolean}
		 */
		_statesstarted : function ( State, state ) {
			var MyState, propname, states = gui.Spirit.$states;
			return Object.keys ( states ).every ( function ( typename ) {
				MyState = this.constructor [ typename ];
				propname = states [ typename ];
				this [ propname ] = State === MyState ? state : null;
				return !MyState || this [ propname ] !== null;
			}, this ); 
		},

		/**
		 * Handle changes.
		 * @param {Array<edb.ObjectChange|edb.ArrayChange>}
		 */
		onchange : function ( changes ) {}
	},
	
	/*
	 * Register default plugins for all spirits.
	 */
	plugins : {
		script : edb.ScriptPlugin,
		input : edb.InputPlugin,
		output : edb.OutputPlugin
	},
	
	/*
	 * Channeling spirits to CSS selectors.
	 */
	channels : [
		[ "script[type='text/edbml']", "edb.ScriptSpirit" ],
		[ "link[rel='service']", "edb.ServiceSpirit" ]
	],

	oncontextinitialize : function ( context ) {
		var plugin, proto, method;
		if ( !context.gui.portalled ) {
			if (( plugin = context.gui.AttConfigPlugin )) {
				proto = plugin.prototype;
				method = proto.$evaluate;
				proto.$evaluate = function ( name, value, fix ) {
					if ( value.startsWith ( "edb.get" )) {
						var key = gui.KeyMaster.extractKey ( value )[ 0 ];
						value = key ? context.edb.get ( key ) : key;
					}
					return method.call ( this, name, value, fix );
				};
			}
		}
	},

	/**
	 * Context spiritualized.
	 * @param {Window} context
	 */
	onafterspiritualize : function ( context ) {
		var doc = context.document;
		if ( gui.Client.isGecko ) { // @TODO: patch in Spiritual?
			doc.addEventListener ( "focus", this, true );
			doc.addEventListener ( "blur", this, true );
		} else {
			doc.addEventListener ( "focusin", this, true );
			doc.addEventListener ( "focusout", this, true );
		}
		
	},

	/**
	 * Handle event.
	 * @param {Event} e
	 */
	handleEvent : function ( e ) {
		switch ( e.type ) {
			case "focusin" :
			case "focus" :
				this.fieldselector = this._fieldselector ( e.target );
				break;
			case "focusout" :
			case "blur" :
				this.fieldselector = null;
				break;
		}
	},


	// Private ...................................................

	/**
	 * Compute selector for form field. We scope it to 
	 * nearest element ID or fallback to document body.
	 * @param {Element} element
	 */
	_fieldselector : function ( elm ) {
		var index = -1;
		var parts = [];
		function hasid ( elm ) {
			if ( elm.id ) {
				try {
					gui.DOMPlugin.q ( elm.parentNode, elm.id );
					return true;
				} catch ( malformedexception ) {}
			}
			return false;
		}
		while ( elm !== null ) {
			if ( hasid ( elm )) {
				parts.push ( "#" + elm.id );
				elm = null;
			} else {
				if ( elm.localName === "body" ) {
					parts.push ( "body" );
					elm = null;
				} else {
					index = gui.DOMPlugin.ordinal ( elm ) + 1;
					parts.push ( ">" + elm.localName + ":nth-child(" + index + ")" );
					elm = elm.parentNode;
				}
			}
		}
		return parts.reverse ().join ( "" );
	}

});