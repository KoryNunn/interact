(function (root, factory) {
    if (typeof exports === 'object') {
        module.exports = factory();
    } else if (typeof define === 'function' && define.amd) {
        define(factory);
    } else {
        root.interact = factory();
    }
}(this, function () {
    var interactions = [],
        minMoveDistance = 5,
        interact = {},
        maximumMovesToPersist = 1000, // Should be plenty..
        propertiesToCopy = 'target,pageX,pageY,clientX,clientY,offsetX,offsetY,screenX,screenY,shiftKey,x,y'.split(','); // Stuff that will be on every interaction.
    
    // document.body.style.webkitTouchCallout = 'none';
    // document.body.style.KhtmlUserSelect = 'none';    
    
    function getActualTarget() {
        // For some reason touch browsers never change the event target during a touch.
        // This is, lets face it, fucking stupid.
        return document.elementFromPoint(this.pageX - window.scrollX, this.pageY - window.scrollY);
    }
    
    
    function getMoveDistance(x1,y1,x2,y2){
        var adj = Math.abs(x1 - x2),
            opp = Math.abs(y1 - y2);
            
        return Math.sqrt(Math.pow(adj,2) + Math.pow(opp,2));
    }
    
    function destroyInteraction(interaction){
        for(var i = 0; i < interactions.length; i++){
            if(interactions[i].identifier === interaction.identifier){
                interactions.splice(i,1);
            }
        }
    }
    
    function getInteraction(identifier){
        for(var i = 0; i < interactions.length; i++){
            if(interactions[i].identifier === identifier){
                return interactions[i];
            }
        }
    }
    
    function copyInteractionInfo(target, interactionInfo){
        // Some touch objects are immutable, so we need to copy their properties over.
        for(var i = 0;  i < propertiesToCopy.length; i++){            
            target[propertiesToCopy[i]] = interactionInfo[propertiesToCopy[i]];
        }
        
        return target;
    }
    
    function Interaction(event, interactionInfo){
        // If there is no event (eg: desktop) just make the identifier undefined
        if(!event){
            event = {};
        }
        // If there is no extra info about the interaction (eg: desktop) just use the event itself            
        if(!interactionInfo){
            interactionInfo = event;
        }
    
        // If there is another interaction with the same ID, something went wrong.
        // KILL IT WITH FIRE!
        var oldInteraction = getInteraction(interactionInfo.identifier);
        oldInteraction && oldInteraction.destroy();
        
        this.identifier = interactionInfo.identifier;

        this.moves = [];
        
        interactions.push(this);
    }
    
    Interaction.prototype = {
        constructor: Interaction,        
        getActualTarget: getActualTarget,
        destroy: function(){
            trigger('destroy', this.target, this, this);
            destroyInteraction(this);
        },
        start: function(event, interactionInfo){
            // If there is no extra info about the interaction (eg: desktop) just use the event itself            
            if(!interactionInfo){
                interactionInfo = event;
            }
            
            // store the info of where the interaction started
            this.lastStart = copyInteractionInfo({}, interactionInfo);
            
            copyInteractionInfo(this, interactionInfo);
        
            trigger('start', event.target, event, this);
            return this;
        },
        move: function(event, interactionInfo){
            // If there is no extra info about the interaction (eg: desktop) just use the event itself            
            if(!interactionInfo){
                interactionInfo = event;
            }
            
            var currentTouch = copyInteractionInfo({}, interactionInfo);
            currentTouch.time = new Date();
            
            // Update the interaction
            copyInteractionInfo(this, interactionInfo);
            
            // Memory saver, culls any moves that are over the maximum to keep.
            this.moves = this.moves.slice(-maximumMovesToPersist);
            
            this.moves.push(currentTouch);
            
            var lastMove = this.moves[this.moves.length-2];
            lastMove && (currentTouch.angle = Math.atan2(currentTouch.pageY - lastMove.pageY, currentTouch.pageX - lastMove.pageX) * 180 / Math.PI);
            this.angle = currentTouch.angle || 0;
            
            trigger('move', event.target, event, this);
            return this;
        },
        drag: function(event, interactionInfo){
            // If there is no extra info about the interaction (eg: desktop) just use the event itself            
            if(!interactionInfo){
                interactionInfo = event;
            }
            
            var currentTouch = copyInteractionInfo({}, interactionInfo);
            currentTouch.time = new Date();
            currentTouch.isDrag = true;
                        
            // Update the interaction
            copyInteractionInfo(this, interactionInfo);
            
            if(!this.moves){
                this.moves = [];
            }
            
            // Memory saver, culls any moves that are over the maximum to keep.            
            this.moves = this.moves.slice(-maximumMovesToPersist);
            
            this.moves.push(currentTouch);
            
            if(!this.dragStarted && getMoveDistance(this.lastStart.pageX, this.lastStart.pageY, currentTouch.pageX, currentTouch.pageY) > minMoveDistance){
                this.dragStarted = true;
            }
            
            var lastDrag = this.moves[this.moves.length-2];
            lastDrag && (currentTouch.angle = Math.atan2(currentTouch.pageY - lastDrag.pageY, currentTouch.pageX - lastDrag.pageX) * 180 / Math.PI);
            this.angle = currentTouch.angle || 0;
            
            if(this.dragStarted){                
                trigger('drag', event.target, event, this);
            }
            return this;
        },
        end: function(event, interactionInfo, activate){
            // If you don't know what this is for by now, you're an idiot...       
            if(!interactionInfo){
                interactionInfo = event;
            }
            
            // Update the interaction
            copyInteractionInfo(this, interactionInfo);
        
            // If the interaction didnt move further than the minMoveDistance,
            // and we are not explicitly telling the interaction it is not an activate (eg, mouse click)
            // or we are forcing an activation (on 'click' for example)
            // Trigger an activate.
            
            if(activate === true || (activate !== false && getMoveDistance(this.lastStart.pageX, this.lastStart.pageY, this.pageX, this.pageY) < minMoveDistance)){
                trigger('activate', event.target, event, this);
                event.preventDefault();
            }
            
            trigger('end', event.target, event, this);
            
            return this;
        },
        cancel: function(event, interactionInfo, activate){
            // If you don't know what this is for by now, you're an idiot...       
            if(!interactionInfo){
                interactionInfo = event;
            }
            
            // Update the interaction
            copyInteractionInfo(this, interactionInfo);
        
            // If the interaction didnt move further than the minMoveDistance,
            // and we are not explicitly telling the interaction it is not an activate (eg, mouse click)
            // or we are forcing an activation (on 'click' for example)
            // Trigger an activate.
            
            trigger('cancel', event.target, event, this);
            
            return this;
        },
        getMoveDistance: function(){
            if(this.moves.length > 1){
                var current = this.moves[this.moves.length-1],
                    previous = this.moves[this.moves.length-2];
                    
                return getMoveDistance(current.pageX, current.pageY, previous.pageX, previous.pageY);
            }
        },
        getSpeed: function(){
            if(this.moves.length > 1){
                var current = this.moves[this.moves.length-1],
                    previous = this.moves[this.moves.length-2];
                    
                return this.getMoveDistance() / (current.time - previous.time);
            }
            return 0;
        },
        getCurrentAngle: function(blend){   
            var currentPosition,
                lastAngle,
                i = this.moves.length-1,
                angle,
                firstAngle,
                angles = [],
                blendSteps = 20/(this.getSpeed()*2+1),
                stepsUsed = 0;
                
            if(this.moves && this.moves.length){
                
                currentPosition = this.moves[i];
                angle = firstAngle = currentPosition.angle;
                
                if(blend && this.moves.length > 1){
                    while(--i > 0 && this.moves.length - i < blendSteps){
                        lastAngle = this.moves[i].angle;
                        if(Math.abs(lastAngle - firstAngle) > 180){
                            angle -= lastAngle
                        }else{
                            angle += lastAngle
                        }
                        stepsUsed++;
                    }
                    angle = angle/stepsUsed;
                }
            }
            return angle;
        },
        getAllInteractions: function(){
            return interactions.slice();
        }
    };
    
    function on(types, target, callback){
        var type;
        
        types = types.split(' ');
        
        for(var i = 0; i < types.length; i++){
            type = types[i];
            if(!target){
                callback = target;
                target = document;
            }
            
            if(!target._interactions){
                target._interactions = {};
            }
            if(!target._interactions[type]){
                target._interactions[type] = [];
            }
            target._interactions[type].push(callback);
        }

        return this;
    }

    // basic but functional
    function off(type, target, callback){
        if(
            target &&
            target._interactions &&
            Array.isArray(target._interactions[type])
        ){
            var index = target._interactions[type].indexOf(callback);

            index >=0 && target._interactions[type].splice(index, 1);
        }

        return this;
    }
    
    function trigger(type, target, event, interaction, eventInfo){
        var currentTarget = target;
                
        interaction.originalEvent = event;
        interaction.preventDefault = function(){
            event.preventDefault();
        }
        interaction.stopPropagation = function(){
            event.stopPropagation();
        }
        
        while(currentTarget){
            currentTarget._interactions &&
            currentTarget._interactions[type] &&
            currentTarget._interactions[type].forEach(function(callback){
                callback(interaction);
            });
            currentTarget = currentTarget.parentNode;
        }
    }
      
    function start(event){
        var touch;
        
        for(var i = 0; i < event.changedTouches.length; i++){
            touch = event.changedTouches[i];
            new Interaction(event, event.changedTouches[i]).start(event, touch);
        }        
    }
    function drag(event){
        var touch;
        
        for(var i = 0; i < event.changedTouches.length; i++){
            touch = event.changedTouches[i];
            getInteraction(touch.identifier).drag(event, touch);
        }
    }
    function end(event){
        var touch;
        
        for(var i = 0; i < event.changedTouches.length; i++){
            touch = event.changedTouches[i];
            getInteraction(touch.identifier).end(event, touch).destroy();
        }
    }
    function cancel(event){
        var touch;

        for(var i = 0; i < event.changedTouches.length; i++){
            touch = event.changedTouches[i];
            getInteraction(touch.identifier).cancel(event, touch).destroy();
        }
    }
    
    addEvent(document, 'touchstart', start);
    addEvent(document, 'touchmove', drag);
    addEvent(document, 'touchend', end);
    addEvent(document, 'touchcancel', cancel);
    
    var mouseIsDown = false;
    addEvent(document, 'mousedown', function(event){
        mouseIsDown = true;
        getInteraction().start(event);
    });
    addEvent(document, 'mousemove', function(event){
        if(!interactions.length){
            new Interaction(event);
        }
        if(mouseIsDown){
            getInteraction().drag(event);
        }else{
            getInteraction().move(event);
        }
    });
    addEvent(document, 'mouseup', function(event){
        mouseIsDown = false;
        getInteraction().end(event, null);
    });
    
    function addEvent(element, type, callback) {
        if(element.addEventListener){
            element.addEventListener(type, callback);
        }
        else if(document.attachEvent){
            element.attachEvent("on"+ type, callback);
        }
    }
    
    interact.on = on;    
    interact.off = off;

    return window.interact = interact;
}));