import {ProjectiveViewOps}  from "./side_view_op.js"
import {FocusImageContext} from "./image.js";
import {saveWorldList, reloadWorldList} from "./save.js"
import {generate_new_unique_id} from "./obj_id_list.js"

/*
2 ways to attach and edit a box
1) attach/detach
2) setTarget, tryAttach, resetTarget, this is only for batch-editor-manager
*/
function BoxEditor(parentUi, boxEditorManager, viewManager, cfg, boxOp, 
    func_on_box_changed, func_on_box_remove, name){
    
    this.boxEditorManager = boxEditorManager;
    this.parentUi = parentUi;
    this.name=name;
    let uiTmpl = document.getElementById("box-editor-ui-template");
    let tmpui = uiTmpl.content.cloneNode(true);  //sub-views
    
    parentUi.appendChild(tmpui);
    this.ui = parentUi.lastElementChild;
    this.boxInfoUi = this.ui.querySelector("#box-info");

    this.viewManager = viewManager;
    this.boxOp = boxOp;
    this.boxView = this.viewManager.addBoxView(this.ui); //this.editorUi.querySelector("#sub-views")
    this.projectiveViewOps = new ProjectiveViewOps(
        this.ui, //this.editorUi.querySelector("#sub-views"),
        cfg,
        this.boxView.views,
        this.boxOp,
        func_on_box_changed,func_on_box_remove);

    this.projectiveViewOps.init_view_operation();

    this.focusImageContext = new FocusImageContext(this.ui.querySelector("#focuscanvas"));
    
    this.target = {};
    this.setTarget = function(world, objTrackId){
        this.target = {
            world: world,
            objTrackId: objTrackId,
        }

        this.tryAttach();
        this.ui.style.display="inline-block";
        this.updateInfo();
    };

    this.resetTarget = function(){
        if (this.target.world){
            //unload if it's not the main world
            if (this.target.world !== this.target.world.data.world)
                this.target.world.unload();
        }

        this.detach();
        this.target = {};
        //this.ui.style.display="none";
    };

    this.tryAttach = function(){
        // find target box, attach to me
        if (this.target){

            let box = this.target.world.annotation.findBoxByTrackId(this.target.objTrackId);
            if (box){
                this.attachBox(box);
            }
        }
    };
    

    /*
     the projectiveView tiggers zoomratio changing event.
     editormanager broaccasts it to all editors
    */
    this._setViewZoomRatio = function(viewIndex, ratio){
        this.boxView.views[viewIndex].zoom_ratio = ratio;
    };

    this.updateViewZoomRatio = function(viewIndex, ratio){
        //this.upate();
        if (this.boxEditorManager)
            this.boxEditorManager.updateViewZoomRatio(viewIndex, ratio);
        else{
            this._setViewZoomRatio(viewIndex, ratio);
            this.update();
            //this.viewManager.render();            
        }
    };


    this.box = null;
    this.attachBox = function(box){
        if (this.box && this.box !== box){
            this.box.boxEditor=null;
            console.log("detach box editor");
            //todo de-highlight box
        }

        this.box = null;
        this.show();

        if (box){
            box.boxEditor = this;
            this.box=box;
            //this.boxOp.highlightBox(box);
            this.boxView.attachBox(box);
            this.projectiveViewOps.attachBox(box);
            this.focusImageContext.updateFocusedImageContext(box);

            this.updateInfo();

        }

        

    };

    this.detach = function(dontHide){
        if (this.box){
            if (this.box.boxEditor === this){
                this.box.boxEditor = null;
            }
            //this.boxOp.unhighlightBox(this.box);
            //todo de-highlight box
            this.projectiveViewOps.detach();
            this.boxView.detach();
            this.focusImageContext.clear_canvas();
            this.box = null;
        }

        if (!dontHide)
            this.hide();
    };

    this.hide = function(){
        this.ui.style.display="none";
    }
    this.show = function(){
        this.ui.style.display="";//"inline-block";
    }

    this.onBoxChanged=function(){
        
        this.projectiveViewOps.update_view_handle();
        this.focusImageContext.updateFocusedImageContext(this.box);
        this.boxView.onBoxChanged();

        // mark
        delete this.box.annotator; // human annotator doesn't need a name
        delete this.box.follows;
        this.box.changed = true;
        
        // don't mark world's change flag, for it's hard to clear it.
        
        // inform boxEditorMgr to transfer annotation to other frames.
        if (this.boxEditorManager)
            this.boxEditorManager.onBoxChanged(this);

        this.updateInfo();
    };

    this.onDelBox = function(){
        let box = this.box;
        this.detach("donthide");


    };

    // windowresize...
    this.update = function(dontRender=false){
        if (this.box === null)
            return;

        this.projectiveViewOps.update_view_handle();
        
        if (this.boxView){
            this.boxView.updateCameraRange(this.box);
            this.boxView.updateCameraPose(this.box);

            if (!dontRender) 
                this.viewManager.render();
        }
        
        // this is not needed somtime
        this.focusImageContext.updateFocusedImageContext(this.box); 

        // should we update info?
        this.updateInfo();
    };


    this.refreshAnnotation = function(){
        if (this.target){
            this.target.world.annotation.reloadAnnotation(()=>{
                this.tryAttach();
                this.update(); // update calls render
                //this.viewManager.render();
            });
        }
    };

    this.updateInfo = function(){
        let info = ""
        if (this.target.world)
            info  += String(this.target.world.frameInfo.frame);
        
        if (this.box && this.box.annotator)
            info += ","+this.box.annotator;

        if (this.box && this.box.changed)
            info += " *";

        this.boxInfoUi.innerHTML = info;
    };

    this.updateBoxDimension = function(){

    };

}


//parentUi  #batch-box-editor-wrapper
function BoxEditorManager(parentUi, fastToolBoxUi, viewManager, cfg, boxOp, globalHeader, func_on_box_changed, func_on_box_remove){
    this.viewManager = viewManager;
    this.boxOp = boxOp;
    this.activeIndex = 0;
    this.editorList = [];
    this.cfg = cfg;
    this.globalHeader = globalHeader;
    this.parentUi = parentUi;
    this.fastToolBoxUi = fastToolBoxUi;
    this.batchSize = 20;

    this.activeEditorList = function(){
        return this.editorList.slice(0, this.activeIndex);
    };

    this.editingTarget = {
        data: null,
        sceneMeta: "",
        objTrackId: "",
        frame:"",
        frameIndex: NaN,
    };
    
    this.onExit = null;
    // frame specifies the center frame to edit
    this.edit = function(data, sceneMeta, frame, objTrackId, onExit){
        
        this.show();
        this.reset();

        if (onExit){
            // next/prev call will not update onExit
            this.onExit = onExit;
        }
        let sceneName = sceneMeta.scene;

        this.editingTarget.data = data;
        this.editingTarget.sceneMeta = sceneMeta;
        this.editingTarget.objTrackId = objTrackId;
        this.editingTarget.frame = frame;

        this.parentUi.querySelector("#object-track-id-editor").value=objTrackId;
        //this.parentUi.querySelector("#object-category-selector").value=objTrackId;
        //we don't know the obj type

        let centerIndex = sceneMeta.frames.findIndex(f=>f==frame);
        this.editingTarget.frameIndex = centerIndex;

        if (centerIndex < 0){
            centerIndex = 0;
        }


        let startIndex = Math.max(0, centerIndex-10);

        sceneMeta.frames.slice(startIndex, startIndex+this.batchSize).forEach((frame)=>{
            let world = data.getWorld(sceneName, frame);
            let editor = this.addEditor();
            editor.setTarget(world, objTrackId);
            
            data.activate_world(world, 
                ()=>{
                    editor.tryAttach();
                    //
                    this.viewManager.render();
                },
                true);
        });
    };
    
    this.reset = function(){
        this.activeEditorList().forEach(e=>e.resetTarget());
        this.activeIndex = 0;
    };

    this.hide =function(){
        this.parentUi.style.display = "none";
    };
    this.show = function(){
        this.parentUi.style.display = "";
    };

    this.onBoxChanged= function(editor){

        //let boxes = this.editorList.map(e=>e.box); //some may be null, that's ok
        //this.boxOp.interpolateSync(boxes);
        // if (this.cfg.enableAutoSave)
        //     this._saveAndTransfer();
    };

    
    
    this._addToolBox = function(){
        let template = document.getElementById("batch-editor-tools-template");
        let tool = template.content.cloneNode(true);
        this.parentUi.appendChild(tool);
        return this.parentUi.lastElementChild;
    };


    this.toolbox = this._addToolBox();

    this.refreshAllAnnotation = function(){
        //this.editorList.forEach(e=>e.refreshAnnotation());
        
        let worldList = this.activeEditorList().map(e=>e.target.world);

        let done = (anns)=>{
            // update editor
            this.activeEditorList().forEach(e=>{
                e.tryAttach();
                e.update("dontrender");
            });

            // render all, at last
            this.viewManager.render();
        };

        reloadWorldList(worldList, done);
    }

    this.parentUi.querySelector("#object-track-id-editor").addEventListener("keydown", function(e){
        e.stopPropagation();});
    
    this.parentUi.querySelector("#object-track-id-editor").addEventListener("keyup", function(e){
        e.stopPropagation();
    });

    this.parentUi.querySelector("#object-track-id-editor").onchange = (ev)=>this.object_track_id_changed(ev);
    this.parentUi.querySelector("#object-category-selector").onchange = (ev)=>this.object_category_changed(ev);

    // this should follow addToolBox
    this.parentUi.querySelector("#refresh").onclick = (e)=>{
        this.refreshAllAnnotation();
    };

    this.parentUi.querySelector("#interpolate").onclick = async ()=>{
        //this.boxOp.interpolate_selected_object(this.editingTarget.scene, this.editingTarget.objTrackId, "");
        let boxList = this.activeEditorList().map(e=>e.box);
        let worldList = this.activeEditorList().map(e=>e.target.world);
        await this.boxOp.interpolateAsync(worldList, boxList)
        this.activeEditorList().forEach(e=>e.tryAttach());
        this.viewManager.render();
    };

    this.parentUi.querySelector("#auto-label").onclick = async ()=>{
        let editors = this.activeEditorList();
        let boxList = editors.map(e=>e.box);
        let worldList = editors.map(e=>e.target.world);

        let onFinishOneBox = (i)=>{
            editors[i].tryAttach();
            this.viewManager.render();
        }
        
        await this.boxOp.interpolateAndAutoAdjustAsync(worldList, boxList, onFinishOneBox)
        // this.activeEditorList().forEach(e=>e.tryAttach());
        // this.viewManager.render();
    };

    this.parentUi.querySelector("#exit").onclick = ()=>{
        this.hide();

        this.reset();

        if (this.onExit)
            this.onExit();
    };

    this.parentUi.querySelector("#next").onclick = ()=>{
        let maxFrameIndex = this.editingTarget.sceneMeta.frames.length-1;
        this.edit(
            this.editingTarget.data,
            this.editingTarget.sceneMeta,
            this.editingTarget.sceneMeta.frames[Math.min(this.editingTarget.frameIndex+10, maxFrameIndex)],
            this.editingTarget.objTrackId
        );
    };

    this.parentUi.querySelector("#prev").onclick = ()=>{
        this.edit(
            this.editingTarget.data,
            this.editingTarget.sceneMeta,
            this.editingTarget.sceneMeta.frames[Math.max(this.editingTarget.frameIndex-10, 0)],
            this.editingTarget.objTrackId
        );
    };

    this.parentUi.querySelector("#save").onclick = ()=>{
        this._save();
    };

    this.parentUi.querySelector("#finalize").onclick = ()=>{
        this.finalize();
    };

    this.parentUi.addEventListener( 'keydown', (event)=>{
        event.preventDefault();
        event.stopPropagation();
        
        switch(event.key){
            case 's':
                if (event.ctrlKey){
                    this._save();
                    console.log("saved for batch editor");
                }
                break;
            case '+':
            case '=':
                this.editingTarget.data.scale_point_size(1.2);
                this.viewManager.render();
                break;
            case '-':
                this.editingTarget.data.scale_point_size(0.8);
                this.viewManager.render();
                break;
            default:
                break;
        }
    });

    this.finalize = function(){
        this.activeEditorList().forEach(e=>{
            if (e.box){
                delete e.box.annotator;
                e.updateInfo();
            }
        })
    };

    this.object_track_id_changed = function(event){
        var id = event.currentTarget.value;

        if (id == "new"){
            id = generate_new_unique_id(this.editingTarget.data.world);            
            this.parentUi.querySelector("#object-track-id-editor").value=id;
        }

        this.activeEditorList().forEach(e=>{
            if (e.box){
                e.box.obj_track_id = id;
            }
        });

    };

    this.object_category_changed = function(event){
        let obj_type = event.currentTarget.value;
        this.activeEditorList().forEach(e=>{
            if (e.box){
                e.box.obj_type = obj_type;
            }
        });
    };


    this._save = function(){
        let worldList = []
        let editorList = []
        this.activeEditorList().forEach(e=>{
            worldList.push(e.target.world);
            editorList.push(e);
        });

        let doneSave = ()=>{
            editorList.forEach(e=>{
                if (e.box)
                    e.box.changed = false;
                e.updateInfo();
            });

            // if (this.activeEditorList().length > 1){ // are we in batch editing mode?
            //     //transfer
            //     let doneTransfer = ()=>{
            //         this.refreshAllAnnotation();
            //     };

            //     this.boxOp.interpolate_selected_object(this.editingTarget.scene, 
            //         this.editingTarget.objTrackId, 
            //         "", 
            //         doneTransfer);
            // }
            
        };

        saveWorldList(worldList, doneSave);
    }


    this.updateViewZoomRatio = function(viewIndex, ratio){
        const dontRender=true;
        this.activeEditorList().forEach(e=>{
            e._setViewZoomRatio(viewIndex, ratio);
            e.update(dontRender);
        })

        // render all
        this.viewManager.render();
    }

    this.addEditor = function(){
        let editor = this.allocateEditor();
        this.activeIndex += 1;
        return editor;
    };

    this.allocateEditor = function(){
        if (this.activeIndex >= this.editorList.length){
            let editor = new BoxEditor(this.parentUi, this, this.viewManager, cfg, this.boxOp, func_on_box_changed, func_on_box_remove, String(this.activeIndex));
            this.editorList.push(editor);
            return editor;
        }else{
            return this.editorList[this.activeIndex];
        }
    };



}
export {BoxEditorManager, BoxEditor};