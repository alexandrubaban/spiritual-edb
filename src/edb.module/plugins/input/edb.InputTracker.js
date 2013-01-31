/**
 * Tracking EDB input.
 * @extends {gui.TrackerPlugin} Note: Doesn't use a lot of super...
 */
edb.InputTracker = gui.TrackerPlugin.extend ( "edb.InputTracker", {
   
	/**
	 * True when one of each expected input type has been collected.
	 * @type {boolean}
	 */
	done : true,
	
	/**
	 * Listing latest inputs, one of each registered type.
	 * @type {Array<edb.Input>} 
	 */
	latest : null,
	
	/**
	 * Mapping data types (edb.Model constructors) to input handlers. 
	 * @type {WeakMap<function,object>}
	 */
	_weakmap : null,
	
	/**
	 * Registered input types (because no available iterator for weakmaps).
	 * TODO: We now have https://bugzilla.mozilla.org/show_bug.cgi?id=725909#c12
	 * @type
	 */
	_types : null,
		
	/**
	 * Add one or more input handlers.
	 * TODO: add support for "type"
	 * @param {object} arg
	 * @param @optional {object} handler implements InputListener (defaults to this)
	 * @returns {gui.Spirit}
	 */
	add : function ( arg, handler ) {

		this.done = false; // TODO: check has() already around here?
		this.latest = this.latest || [];
		this._types = this._types || [];
		this._weakmap = this._weakmap || new WeakMap ();
		
		handler = handler ? handler : this.spirit;
		
		var maybe = [];
		var types = this._breakdown ( arg );
		
		types.forEach ( function ( type, index ) {
			if ( !this._weakmap.get ( type )) {
				this._weakmap.set ( type, []);
			}
			this._weakmap.get ( type ).push ( handler );
			if ( this._types.indexOf ( type ) === -1 ) {
				this._types.push ( type );
				if ( this._types.length === 1 ) {
					edb.Input.add ( this ); // await future output of this type
				}
				if ( type.output instanceof edb.Input ) { // type has been output?
					if ( !this.spirit || this.spirit.life.ready ) {
						var tick = gui.TICK_COLLECT_INPUT;
						var sig = this.context.gui.signature;
						gui.Tick.one ( tick, this, sig ).dispatch ( tick, 0, sig );
					} else {
						this.spirit.life.add ( gui.SpiritLife.READY, this );
					}
				}
			}
		}, this );
		
		return this.spirit;
	},

	/**
	 * Remove one or output handlers.
	 * @param {object} arg
	 * @param @optional {object} handler implements InputListener (defaults to this)
	 * @returns {gui.Spirit}
	 */
	remove : function ( arg, handler ) {
		
		/*
		 * TODO: various updates after this operation
		 */
		handler = handler ? handler : this;
		this._breakdown ( arg ).forEach ( function ( type ) {
			var index = this._types.indexOf ( type );
			if ( index >-1 ) {
				this._types.remove ( index ); // TODO; rebuild and stuff! plus remove broadcast handler if zero
				if ( handler !== this ) {
					throw "not implemented"; // TODO
				}
			}
		}, this );
		return this.spirit;
	},
	
	/**
	 * Get data for latest input of type.
	 * @param {function} type
	 * @returns {object}
	 */
	get : function ( type ) {
		
		var data;
		if ( this.latest ) {
			this.latest.every ( function ( input ) {
				if ( input.type === type ) {
					data = input.data;
				}
				return data === undefined;
			});
		}
		return data;
	},
	
	/**
	 * Route broadcasted input to handlers.
	 * @param {gui.Broadcast} b
	 */
	onbroadcast : function ( b ) {
		
		if ( b.type === gui.BROADCAST_OUTPUT ) {
			this._maybeinput ( b.data );
		}
	},
	
	/**
	 * In this case, input for spirit exists before the spirit was created. 
	 * We normally trigger the spirits builder on "attach" (because a build  
	 * will nuke all descendant spirits anyway) but in this case we need 
	 * to wait for "ready" so that inline builder script can register first. 
	 * @param {gui.SpiritLife} life
	 */
	onlife : function ( life ) {
		
		if ( life.type === gui.SpiritLife.READY ) {
			this._todoname ();
		}
	},
	
	/**
	 * Handle tick.
	 * @param {gui.Tick} tick
	 */
	ontick : function ( tick ) {

		if ( tick.type === gui.TICK_COLLECT_INPUT ) {
			this._todoname ();
		}
	},

	/**
	 * TODO: think about this...
	 * @overwrites {gui.Plugin#destruct}
	 */
	destruct : function () {
		
		this._super.destruct ();
		gui.Tick.remove ( gui.TICK_COLLECT_INPUT, this, this.context.gui.signature );
		if ( this._types ) {
			this._types.forEach ( function ( type ) {
				this._weakmap.del ( type );
			}, this );
			delete this._types;
		}
		delete this._weakmap;
	},

	
	// PRIVATES .........................................................................................
	
	/*
	 * Collect all types before evaluating this.done; make sure 
	 * that all required types are served in a single array, 
	 * otherwise script.run () may be invoked prematurely.
	 * TODO: Update the above to reflect modern API
	 */
	_todoname : function () {

		this._types.forEach ( function ( type ) {
			if ( type.output instanceof edb.Input ) {
				this._maybeinput ( type.output );
			}
		}, this );
	},

	/**
	 * Delegate input to handlers if type matches expected.
	 * @param {edb.Input} input
	 */
	_maybeinput : function ( input ) {

		var type = input.type;
		if ( this._types.indexOf ( type ) >-1 ) {

			// remove old entry (no longer latest)
			this.latest.every ( function ( collected, i ) {
				var match = ( collected.type === type );
				if ( match ) {
					this.latest.remove ( i );
				}
				return !match;
			}, this );

			// add latest entry and flag all accounted for
			this.done = ( this.latest.push ( input ) === this._types.length );

			// handlers updated even when not all accounted for
			this._weakmap.get ( type ).forEach ( function ( handler ) {
				handler.oninput ( input );
			});
		}
	},
	
	/**
	 * Resolve argument into array of one or more function constructors (data types).
	 * @param {object} arg
	 * @returns {Array<function>}
	 */
	_breakdown : function ( arg ) {
		
		var result = null;
		if ( gui.Type.isArray ( arg )) {
			result = this._breakarray ( arg );
		} else {
			result = this._breakother ( arg );
		}
		return result;
	},
	
	/**
	 * @param {Array<object>}
	 * @returns {Array<function>}
	 */
	_breakarray : function ( array ) {
		
		return array.map ( function ( o ) {
			var res = null;
			switch ( gui.Type.of ( o )) {
				case "function" :
					res = o;
					break;
				case "string" :
					res = gui.Object.lookup ( o, this.context );
					break;
				case "object" :
					console.error ( this + ": expected function (not object)" );
					break;
			}
			return res;
		}, this );
	},
	
	/**
	 * @param {object} arg
	 * @returns {Array<function>}
	 */
	_breakother : function ( arg ) {
		
		var result = null;
		switch ( gui.Type.of ( arg )) {
			case "function" :
				result = [ arg ];
				break;
			case "string" :
				result = this._breakarray ( arg.split ( " " ));
				break;
			case "object" :
				console.error ( this + ": expected function (not object)" );
				break;
		}
		return result;
	}
});