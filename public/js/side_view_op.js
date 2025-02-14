
import {matmul2} from "./util.js"

import {
	Quaternion,
	Vector3
} from "./lib/three.module.js";

function ProjectiveViewOps(ui, editorCfg, boxEditor, views, boxOp, func_on_box_changed,func_on_box_remove){

    this.ui = ui;
    this.cfg = editorCfg;
    this.on_box_changed = func_on_box_changed;
    this.views = views;
    this.boxOp = boxOp;
    this.boxEditor = boxEditor;
    //internals
    var scope = this;

    function create_view_handler(ui, 
        on_edge_changed, 
        on_direction_changed, 
        on_auto_shrink, 
        on_moved, 
        on_scale, 
        on_wheel, 
        on_fit_size,
        on_auto_rotate, 
        on_reset_rotate, 
        on_focus=default_on_focus, 
        on_contextmenu=default_context_menu,
        on_box_remove=default_on_del){
        var mouse_start_pos;
    
        var view_handle_dimension = {  //dimension of the enclosed box
            x: 0,  //width
            y: 0,  //height
        }
        
        var view_center = {
            x: 0,
            y: 0,
        };
    
        var view_port_pos = {
            x:0,
            y:0,
        }
    
        var lines = {
            top: ui.querySelector("#line-top"),
            bottom: ui.querySelector("#line-bottom"),
            left: ui.querySelector("#line-left"),
            right: ui.querySelector("#line-right"),
            direction: ui.querySelector("#line-direction"),            
        };

        var orgPointInd = ui.querySelector("#origin-point-indicator");
    
        var svg = ui.querySelector("#view-svg");
        var div = ui;
    
        var handles = {
            
            top: ui.querySelector("#line-top-handle"),
            bottom: ui.querySelector("#line-bottom-handle"),
            left: ui.querySelector("#line-left-handle"),
            right: ui.querySelector("#line-right-handle"),
            direction: ui.querySelector("#line-direction-handle"),
    
            topleft: ui.querySelector("#top-left-handle"),
            topright: ui.querySelector("#top-right-handle"),
            bottomleft: ui.querySelector("#bottom-left-handle"),
            bottomright: ui.querySelector("#bottom-right-handle"),
    
            move: ui.querySelector("#move-handle"),
        }
    
        var buttons = {
            fit_position: ui.querySelector("#v-fit-position"),
            fit_size: ui.querySelector("#v-fit-size"),
            fit_rotation: ui.querySelector("#v-fit-rotation"),
            fit_all: ui.querySelector("#v-fit-all"),
            reset_rotation: ui.querySelector("#v-reset-rotation"),
            fit_moving_direction: ui.querySelector("#v-fit-moving-direction"),
        };
        
        
    
        function line(name){
            return lines[name];
        }
    
        function show_lines(lines){
            let theme = document.documentElement.className;

            let lineColor = "yellow";
            if (theme == "theme-light")
                lineColor = "red";

            for (var l in lines){
                lines[l].style.stroke=lineColor;
            };

        }

        function hightlight_line(line)
        {
            let theme = document.documentElement.className;

            let lineColor = "red";
            if (theme == "theme-light")
                lineColor = "blue";

            line.style.stroke=lineColor;
        }
    
        function hide_lines(lines){
            for (var l in lines){
                lines[l].style.stroke="#00000000";
            }
        };
    
        function disable_handle_except(exclude){
            for (var h in handles){
                if (handles[h] != exclude)
                    handles[h].style.display='none';
            }
        }
    
        function enable_handles(){
            for (var h in handles){
                handles[h].style.display='inherit';
            }
        }
    
        function move_lines(delta, direction){
            
            var x1 = view_center.x-view_handle_dimension.x/2;
            var y1 = view_center.y-view_handle_dimension.y/2;
            var x2 = view_center.x+view_handle_dimension.x/2;
            var y2 = view_center.y+view_handle_dimension.y/2;
    
            if (direction){
                if (direction.x == 1){ //right
                    x2 += delta.x;
                } else if (direction.x == -1){ //left
                    x1 += delta.x;
                }
    
                if (direction.y == -1){ //bottom
                    y2 += delta.y;
                } else if (direction.y == 1){ //top
                    y1 += delta.y;
                }
            } 
            else {
                x1 += delta.x;
                y1 += delta.y;
                x2 += delta.x;
                y2 += delta.y;   
            }
    
            set_line_pos(Math.ceil(x1),Math.ceil(x2),Math.ceil(y1),Math.ceil(y2));        
        }
    
        function set_line_pos(x1,x2,y1,y2){
            lines.top.setAttribute("x1", "0%");
            lines.top.setAttribute("y1", y1);
            lines.top.setAttribute("x2", "100%");
            lines.top.setAttribute("y2", y1);
    
            lines.bottom.setAttribute("x1", "0%");
            lines.bottom.setAttribute("y1", y2);
            lines.bottom.setAttribute("x2", "100%");
            lines.bottom.setAttribute("y2", y2);
    
            lines.left.setAttribute("x1", x1);
            lines.left.setAttribute("y1", "0%");
            lines.left.setAttribute("x2", x1);
            lines.left.setAttribute("y2", "100%");
    
            lines.right.setAttribute("x1", x2);
            lines.right.setAttribute("y1", "0%");
            lines.right.setAttribute("x2", x2);
            lines.right.setAttribute("y2", "100%");
        }
    
        function set_org_point_ind_pos(viewWidth, viewHeight, objPos, objRot){
            /*
            cos -sin 
            sin  cos
            *
            objPos.x
            objPos.y

            */
           let c = Math.cos(objRot);  // for topview, x goes upward, so we add pi/2
           let s = Math.sin(objRot);

           let relx = c*(-objPos.x) + s*(-objPos.y);
           let rely = -s*(-objPos.x) + c*(-objPos.y);

           let radius = Math.sqrt(viewWidth*viewWidth/4 + viewHeight*viewHeight/4);
           let distToRog = Math.sqrt(relx*relx + rely*rely)

           let indPosX3d = relx*radius/distToRog;
           let indPosY3d = rely*radius/distToRog;

           let indPosX = -indPosY3d;
           let indPosY = -indPosX3d;
        
           let dotRelPos = 0.8;
           // now its pixel coordinates, x goes right, y goes down
           if (indPosX > viewWidth/2*dotRelPos){
                let shrinkRatio = viewWidth/2*dotRelPos/indPosX;

                indPosX = viewWidth/2*dotRelPos;
                indPosY = indPosY*shrinkRatio;
           }

            if (indPosX < -viewWidth/2*dotRelPos){
                let shrinkRatio = -viewWidth/2*dotRelPos/indPosX;

                indPosX = -viewWidth/2*dotRelPos;
                indPosY = indPosY*shrinkRatio;
            }

            if (indPosY > viewHeight/2*dotRelPos){
                let shrinkRatio = viewHeight/2*dotRelPos/indPosY;

                indPosY = viewHeight/2*dotRelPos;
                indPosX = indPosX*shrinkRatio;
           }

            if (indPosY < -viewHeight/2*dotRelPos){
                let shrinkRatio = -viewHeight/2*dotRelPos/indPosY;

                indPosY = -viewHeight/2*dotRelPos;
                indPosX = indPosX*shrinkRatio;
            }


           orgPointInd.setAttribute("cx", viewWidth/2+indPosX);
           orgPointInd.setAttribute("cy", viewHeight/2+indPosY);
        }

        // when direction handler is draging
        function rotate_lines(theta){
    
            console.log(theta);
            theta = -theta-Math.PI/2;
            console.log(theta);
            // we use rotation matrix
            var trans_matrix =[
                Math.cos(theta), Math.sin(theta), view_center.x,
                -Math.sin(theta), Math.cos(theta), view_center.y,
                0, 0, 1,
            ]
    
            var points ;/*= `[
                -view_handle_dimension.x/2, view_handle_dimension.x/2,view_handle_dimension.x/2,-view_handle_dimension.x/2, 0,
                -view_handle_dimension.y/2, -view_handle_dimension.y/2,view_handle_dimension.y/2,  view_handle_dimension.y/2, -view_center.y,
                1,1,1,1,1
            ]; */
            var trans_points ;//= matmul2(trans_matrix, points, 3);
    
            //console.log(points);
            //var trans_points ;//= matmul2(trans_matrix, points, 3);
            //console.log(trans_points);
    
            points =[
                0,
                -view_center.y,
                1
            ];
            trans_points = matmul2(trans_matrix, points, 3);
            lines.direction.setAttribute("x2", Math.ceil(trans_points[0]));
            lines.direction.setAttribute("y2", Math.ceil(trans_points[1]));
    
            points =[
                -view_center.x, view_center.x,//-view_handle_dimension.x/2, view_handle_dimension.x/2,
                -view_handle_dimension.y/2, -view_handle_dimension.y/2,
                1,1,
            ];
            var trans_points = matmul2(trans_matrix, points, 3);
    
            lines.top.setAttribute("x1", Math.ceil(trans_points[0]));
            lines.top.setAttribute("y1", Math.ceil(trans_points[0+2]));
            lines.top.setAttribute("x2", Math.ceil(trans_points[1]));
            lines.top.setAttribute("y2", Math.ceil(trans_points[1+2]));
    
    
            points =[
                -view_handle_dimension.x/2, -view_handle_dimension.x/2,
                -view_center.y, view_center.y,
                1,1,
            ];
            trans_points = matmul2(trans_matrix, points, 3);
    
            lines.left.setAttribute("x1", Math.ceil(trans_points[0]));
            lines.left.setAttribute("y1", Math.ceil(trans_points[0+2]));
            lines.left.setAttribute("x2", Math.ceil(trans_points[1]));
            lines.left.setAttribute("y2", Math.ceil(trans_points[1+2]));
    
    
            points =[
                view_center.x,-view_center.x,
                view_handle_dimension.y/2,  view_handle_dimension.y/2,
                1,1
            ];
            trans_points = matmul2(trans_matrix, points, 3);
            lines.bottom.setAttribute("x1", Math.ceil(trans_points[1]));
            lines.bottom.setAttribute("y1", Math.ceil(trans_points[1+2]));
            lines.bottom.setAttribute("x2", Math.ceil(trans_points[0]));
            lines.bottom.setAttribute("y2", Math.ceil(trans_points[0+2]));
    
            points =[
                 view_handle_dimension.x/2,view_handle_dimension.x/2,
                -view_center.y,view_center.y,
                1,1
            ];
            trans_points = matmul2(trans_matrix, points, 3);
    
            lines.right.setAttribute("x1", Math.ceil(trans_points[0]));
            lines.right.setAttribute("y1", Math.ceil(trans_points[0+2]));
            lines.right.setAttribute("x2", Math.ceil(trans_points[1]));
            lines.right.setAttribute("y2", Math.ceil(trans_points[1+2]));
    
        }
        
        function update_view_handle(viewport, obj_dimension, obj_pos, obj_rot){
            var viewport_ratio = viewport.width/viewport.height;
            var box_ratio = obj_dimension.x/obj_dimension.y;
        
            view_port_pos.x = viewport.left;
            view_port_pos.y = viewport.bottom-viewport.height;
    
            var width=0;
            var height=0;
        
            if (box_ratio > viewport_ratio){
                //handle width is viewport.width*2/3
                width = viewport.width*(2/3)/viewport.zoom_ratio;
                height = width/box_ratio;
            }
            else{
                //handle height is viewport.height*2/3
                height = viewport.height*2/3/viewport.zoom_ratio;
                width = height*box_ratio;
            }
        
            view_handle_dimension.x = width;
            view_handle_dimension.y = height;
        
            // viewport width/height is position-irrelavent
            // so x and y is relative value.
            var x = viewport.width/2;//viewport.left + viewport.width/2;
            var y = viewport.height/2//viewport.bottom - viewport.height/2;
        
            var left = x-width/2;
            var right = x+width/2;
            var top = y-height/2;
            var bottom = y+height/2;
        
            view_center.x = x;
            view_center.y = y;
        
            set_line_pos(left, right, top, bottom);

            if (obj_pos && obj_rot){
                set_org_point_ind_pos(viewport.width, viewport.height, obj_pos, obj_rot);
            }
        
            // note when the object is too thin, the height/width value may be negative,
            // this causes error reporting, but we just let it be.
            var de = handles.left;
            de.setAttribute('x', Math.ceil(left-10));
            de.setAttribute('y', "0%"); //Math.ceil(top+10));
            de.setAttribute('height', "100%");//Math.ceil(bottom-top-20));
            de.setAttribute('width', 20);
    
        
            de = handles.right;
            de.setAttribute('x', Math.ceil(right-10));
            de.setAttribute('y', "0%");//Math.ceil(top+10));
            de.setAttribute('height', "100%");//Math.ceil(bottom-top-20));
            de.setAttribute('width', 20);
            
            de = handles.top;
            de.setAttribute('x', "0%");//Math.ceil(left+10));
            de.setAttribute('y', Math.ceil(top-10));
            de.setAttribute('width', "100%");//Math.ceil(right-left-20));
            de.setAttribute('height', 20);
    
            de = handles.bottom;
            de.setAttribute('x', "0%");//Math.ceil(left+10));
            de.setAttribute('y', Math.ceil(bottom-10));
            de.setAttribute('width', "100%");//Math.ceil(right-left-20));
            de.setAttribute('height', 20);
        
    
            de = handles.topleft;
            de.setAttribute('x', Math.ceil(left-10));
            de.setAttribute('y', Math.ceil(top-10));
    
    
            de = handles.topright;
            de.setAttribute('x', Math.ceil(right-10));
            de.setAttribute('y', Math.ceil(top-10));
    
    
            de = handles.bottomleft;
            de.setAttribute('x', Math.ceil(left-10));
            de.setAttribute('y', Math.ceil(bottom-10));
    
            de = handles.bottomright;
            de.setAttribute('x', Math.ceil(right-10));
            de.setAttribute('y', Math.ceil(bottom-10));
    
            //direction
            if (on_direction_changed){
                de = lines.direction;
                de.setAttribute('x1', Math.ceil((left+right)/2));
                de.setAttribute('y1', Math.ceil((top+bottom)/2));
                de.setAttribute('x2', Math.ceil((left+right)/2));
                de.setAttribute('y2', Math.ceil(0));
            
                de = handles.direction;
                de.setAttribute('x', Math.ceil((left+right)/2-10));
                de.setAttribute('y', 0);//Math.ceil(top+10));    
                de.setAttribute('height', Math.ceil((bottom-top)/2-10+top));
            }
            else{
                de = lines.direction;
                de.style.display = "none";
            
                de = handles.direction;
                de.style.display = "none";
            }
    
    
            // move handle
            de = ui.querySelector("#move-handle");
            de.setAttribute('x', Math.ceil((left+right)/2-10));
            de.setAttribute('y', Math.ceil((top+bottom)/2-10));
        }
        
        
        function init_view_operation(){
            
            var mouseLeftDown = false;
    
            div.onkeydown = on_key_down;
            div.onmouseenter = function(event){

                if (scope.boxEditor.box)
                {
                    div.focus();

                    ui.querySelector("#v-buttons").style.display="inherit";

                    if (on_focus)
                        on_focus();
                }
            };
            div.onmouseleave = function(event){
                ui.querySelector("#v-buttons").style.display="none";
                div.blur();
                mouseLeftDown = false;
            };
    
            // div.oncontextmenu = (event)=>{
            //     //console.log("context menu on prjective view.");
            //     on_contextmenu(event);
            //     return false;
            // };
    
            // div.onmousedown = function(event){
            //     if (event.which==1){
            //         mouseLeftDown = true;
            //         event.preventDefault();
            //         event.stopPropagation();
            //         return false;
            //     }
            // };
    
            // div.onmouseup = function(event){
            //     if (event.which==1){
            //         mouseLeftDown = false;
            //         event.preventDefault();
            //         event.stopPropagation();
            //     }
            // };
    
            div.onwheel = function(event){                    
                event.stopPropagation();
                event.preventDefault();

                //console.log(event);
                // if (event.deltaY>0){
                //     console.log("down");
                // } else {
                //     console.log("up");
                // }
    
                on_wheel(event.deltaY);        
            };
    
            install_edge_hanler('left', handles.left,   lines,   {x:-1,y:0});
            install_edge_hanler('right', handles.right,  lines,   {x:1, y:0});
            install_edge_hanler('top', handles.top,    lines,   {x:0, y:1});
            install_edge_hanler('bottom', handles.bottom, lines,   {x:0, y:-1});
            install_edge_hanler('top,left', handles.topleft, lines,   {x:-1, y:1});
            install_edge_hanler('top,right', handles.topright, lines,   {x:1, y:1});
            install_edge_hanler('bottom,left', handles.bottomleft, lines,   {x:-1, y:-1});
            install_edge_hanler('bottom,right', handles.bottomright, lines,   {x:1, y:-1});
            install_edge_hanler('left,right,top,bottom', handles.move, lines,  null);
    
            if (on_direction_changed){
                install_direction_handler("line-direction");
            }

            let ignore_left_mouse_down = (event)=>{
                if (event.which == 1){
                    event.stopPropagation();
                }
            };

            if (buttons.fit_rotation){
                buttons.fit_rotation.onmousedown = ignore_left_mouse_down;
                buttons.fit_rotation.onclick = function(event){
                    on_auto_rotate("noscaling")
                };
            }

            if (buttons.fit_position && on_fit_size){
                buttons.fit_position.onmousedown = ignore_left_mouse_down;
                buttons.fit_position.onclick = function(event){
                    on_fit_size("noscaling");
                };
            }

            if (buttons.fit_size && on_fit_size){

                buttons.fit_size.onmousedown = ignore_left_mouse_down;
                buttons.fit_size.onclick = function(event){
                    on_fit_size();
                };
            }
        
            buttons.fit_all.onmousedown = ignore_left_mouse_down;
                
            buttons.fit_all.onclick = function(event){
                //console.log("auto rotate button clicked.");
                on_auto_rotate();
                //event.currentTarget.blur();  // this bluring will disable focus on sideview also, which is not expected.
            }
    


            if (buttons.reset_rotation){

                buttons.reset_rotation.onmousedown = ignore_left_mouse_down;

                buttons.reset_rotation.onclick = function(event){
                    //console.log("auto rotate button clicked.");
                    on_reset_rotate();
                    //event.currentTarget.blur();  // this bluring will disable focus on sideview also, which is not expected.
                }
            }

            if (buttons.fit_moving_direction){
                buttons.fit_moving_direction.onmousedown = ignore_left_mouse_down;
                buttons.fit_moving_direction.onclick = function(event){
                    //console.log("auto rotate button clicked.");
                    on_auto_rotate("noscaling", "moving-direction");
                    //event.currentTarget.blur();  // this bluring will disable focus on sideview also, which is not expected.
                }
            }
    
            function hide(){
                hide_lines(lines);
            };
            //install_move_handler();
    
            function install_edge_hanler(name, handle, lines, direction)
            {
                                                               
                handle.onmouseenter = ()=>{
                    if (scope.boxEditor.box){
                        show_lines(lines);

                        if (name)
                            name.split(",").forEach(n=> hightlight_line(lines[n]));
                    }


                };    
                handle.onmouseleave = hide;
    
        
                // handle.onmouseup = function(event){
                //     if (event.which!=1)
                //         return;

                //     //line.style["stroke-dasharray"]="none";
                //     //hide();
                //     handle.onmouseleave = hide;
                // };
        
                handle.ondblclick= function(event){
                    if (event.which!=1)
                        return;
                    event.stopPropagation();
                    event.preventDefault();
                    on_auto_shrink(direction); //if double click on 'move' handler, the directoin is null
                    
                };
        
                handle.onmousedown = function(event){
                    if (event.which!=1)
                        return;

                    //
                    event.stopPropagation();
                    event.preventDefault();

                    
                    disable_handle_except(handle);
                    ui.querySelector("#v-buttons").style.display="none";

                    handle.onmouseleave = null;
    
                    var lines_pos = {
                        x1 : parseInt(lines.top.getAttribute('x1')),
                        y1 : parseInt(lines.top.getAttribute('y1')),
                        x2 : parseInt(lines.right.getAttribute('x2')),
                        y2 : parseInt(lines.right.getAttribute('y2')),
                    };
        
                    mouse_start_pos={x: event.layerX,y:event.layerY,};
                    var mouse_cur_pos = {x: mouse_start_pos.x, y: mouse_start_pos.y};
        
                    console.log(mouse_start_pos);
        
                    svg.onmouseup = function(event){
                        svg.onmousemove = null;
                        svg.onmouseup=null;
                        enable_handles();
                        // restore color
                        //hide();
                        handle.onmouseleave = hide;
                        
                        ui.querySelector("#v-buttons").style.display="inherit";

                        var handle_delta = {
                            x: mouse_cur_pos.x - mouse_start_pos.x,
                            y: -(mouse_cur_pos.y - mouse_start_pos.y),  //reverse since it'll be used by 3d-coord system
                        };
    
                        console.log("delta", handle_delta);
                        if (handle_delta.x == 0 && handle_delta.y==0 && !event.ctrlKey && !event.shiftKey){
                            return;
                        }

                        var ratio_delta = {
                            x: handle_delta.x/view_handle_dimension.x,
                            y: handle_delta.y/view_handle_dimension.y
                        };
                        
                        
                        if (direction){
                            on_edge_changed(ratio_delta, direction, event.ctrlKey, event.shiftKey);
    
                            // if (event.ctrlKey){
                            //     on_auto_shrink(direction);
                            // }
                        }
                        else{
                            // when intall handler for mover, the direcion is left null
                            on_moved(ratio_delta);
                        }
                    }
        
                    svg.onmousemove = function(event){

                        if (event.which!=1)
                            return;
                        
                        mouse_cur_pos={x: event.layerX,y:event.layerY,};
                        
                        var handle_delta = {
                            x: mouse_cur_pos.x - mouse_start_pos.x,
                            y: mouse_cur_pos.y - mouse_start_pos.y,  // don't reverse direction
                        };
    
                        move_lines(handle_delta, direction);
                    }
                };
            }
        
            function install_direction_handler(linename){
                var handle = ui.querySelector("#"+linename+"-handle");
                var line = ui.querySelector("#"+linename);
                var svg = ui.querySelector("#view-svg");
        
                handle.onmouseenter = (event)=>{
                    if (scope.boxEditor.box){
                        show_lines(lines);
                        hightlight_line(line);
                    }
                };
                /*function(event){
                    line.style.stroke="black";
                };
                */
        
                handle.onmouseleave = hide;
        
                handle.ondblclick= function(event){
                    event.stopPropagation();
                    event.preventDefault();
                    //transform_bbox(this_axis+"_rotate_reverse");
                    on_direction_changed(Math.PI);
                };
        
        
                // function hide(event){
                //     line.style.stroke="#00000000";
                // };
        
                // handle.onmouseup = function(event){
                //     if (event.which!=1)
                //         return;
                //     //line.style["stroke-dasharray"]="none";
                //     //line.style.stroke="#00000000";
                //     handle.onmouseleave = hide;
                // };
        
                handle.onmousedown = function(event){
                    
                    if (event.which!=1)
                        return;

                    event.stopPropagation();
                    event.preventDefault();
    
                    //line.style.stroke="yellow";
                    handle.onmouseleave = null;
                    //show_lines(lines);
                    
                    disable_handle_except(handle);
    
                    ui.querySelector("#v-buttons").style.display="none";
    
                    var handle_center={
                        x: parseInt(line.getAttribute('x1')),
                    }
        
                    mouse_start_pos={
                        x: event.layerX,
                        y:event.layerY,
        
                        handle_offset_x: handle_center.x - event.layerX,                
                    };
        
        
                    var mouse_cur_pos = {x: mouse_start_pos.x, y: mouse_start_pos.y};
        
                    console.log(mouse_start_pos);
        
                    var theta = 0;
        
                    svg.onmousemove = function(event){
                        
                        mouse_cur_pos={x: event.layerX,y:event.layerY,};
                        
                        var handle_center_cur_pos = {
                            x: mouse_cur_pos.x + mouse_start_pos.handle_offset_x,
                            y: mouse_cur_pos.y,
                        };
        
                        
        
                        theta = Math.atan2(
                            handle_center_cur_pos.y-view_center.y,  
                            handle_center_cur_pos.x-view_center.x);
                        console.log(theta);
    
                        rotate_lines(theta);
                    };
    
                    svg.onmouseup = function(event){
                        svg.onmousemove = null;
                        svg.onmouseup=null;
        
                        // restore color
                        //line.style.stroke="#00000000";
                        enable_handles();
                        handle.onmouseleave = hide;
    
                        ui.querySelector("#v-buttons").style.display="inherit";

                        if (theta == 0){
                            return;
                        }
        
                        on_direction_changed(-theta-Math.PI/2, event.ctrlKey);
                        
                    };
    
                    
                };
            }
        
            function on_key_down(event){
                
                switch(event.key){
                    case 'e':
                        event.preventDefault();
                        event.stopPropagation();
                        on_direction_changed(-scope.cfg.rotateStep, event.ctrlKey);
                        
                        return true;
                    case 'q':
                        event.preventDefault();
                        event.stopPropagation();
                        on_direction_changed(scope.cfg.rotateStep, event.ctrlKey);
                        break;
                    case 'f':
                        event.preventDefault();
                        event.stopPropagation();
                        on_direction_changed(-scope.cfg.rotateStep, true);
                        break;
                    case 'r':                
                        event.preventDefault();
                        event.stopPropagation();
                        on_direction_changed(scope.cfg.rotateStep, true);
                        break;
                    case 'g':
                        event.preventDefault();
                        event.stopPropagation();
                        on_direction_changed(Math.PI, false);
                        break;
                    case 'w':
                    case 'ArrowUp':
                        event.preventDefault();
                        event.stopPropagation();
                        if (mouseLeftDown){
                            //console.log("right mouse down!");
                            on_scale({x:0, y: scope.cfg.moveStep});
                        }
                        else{
                            on_moved({x:0, y: scope.cfg.moveStep});
                        }
                        break;
                    case 's':
                        if (!event.ctrlKey){
                            event.preventDefault();
                            event.stopPropagation();
                            if (mouseLeftDown){
                                //console.log("right mouse down!");
                                on_scale({x:0, y:-scope.cfg.moveStep});
                            }
                            else
                                on_moved({x:0, y:-scope.cfg.moveStep});
                            break;    
                        } else{
                            console.log("ctrl+s");
                        }
                        break;
                    case 'ArrowDown':
                        event.preventDefault();
                        event.stopPropagation();
                        if (mouseLeftDown){
                            //console.log("right mouse down!");
                            on_scale({x:0, y:-scope.cfg.moveStep});
                        }
                        else
                            on_moved({x:0, y:-scope.cfg.moveStep});
                        break;
                    case 'a':
                        if (event.ctrlKey)
                        {
                            break;
                        }
                        // no break;
                    case 'ArrowLeft':
                        event.preventDefault();
                        event.stopPropagation();
                        if (mouseLeftDown)
                            on_scale({x:-scope.cfg.moveStep, y:0});
                        else
                            on_moved({x:-scope.cfg.moveStep, y:0});
                        break;
                    case 'd':
                        if (event.ctrlKey){
                            console.log("ctrl+d");
                            default_on_del();
                            break;
                        }
                    case 'ArrowRight':
                        event.preventDefault();
                        event.stopPropagation();
                        if (mouseLeftDown)
                            on_scale({x:scope.cfg.moveStep, y:0});
                        else
                            on_moved({x:scope.cfg.moveStep, y:0});
                        break;
                    case 'Delete':
                        default_on_del();
                        break;
                }
            }
    
            
            
        }
    
        return {
            update_view_handle: update_view_handle,
            init_view_operation: init_view_operation,
        }
    }
    
    

    function default_on_del(){
        if (scope.box){
            func_on_box_remove(scope.box);
        }
    }

    function default_on_focus(){
        // this is a long chain!
        if (scope.box && scope.box.boxEditor.boxEditorManager)
            scope.box.boxEditor.boxEditorManager.globalHeader.update_box_info(scope.box);
    }

    function default_context_menu(event){
        // console.log("context menu.", scope.boxEditor.index);
        // scope.boxEditor.onContextMenu(event);
        // event.stopPropagation();
        // event.preventDefault();
    }


    // direction: 1, -1
    // axis: x,y,z

    function auto_shrink(extreme, direction){

        for (var axis in direction){

            if (direction[axis] !=0){

                var end = "max";
                if (direction[axis] === -1){
                    end = "min";
                }
                
                var delta = direction[axis]*extreme[end][axis] - scope.box.scale[axis]/2;

                console.log(extreme, delta);
                scope.boxOp.translate_box(scope.box, axis, direction[axis]* delta/2 );
                scope.box.scale[axis] += delta;
            }
        }
    }



    //direction is in 3d
    function auto_stick(delta, direction, use_box_bottom_as_limit){
        //let old_dim = scope.box.world.lidar.get_points_dimmension_of_box(scope.box, true);
        //let old_scale = scope.box.scale;

        let virtbox = {
            position: {
                x: scope.box.position.x,
                y: scope.box.position.y,
                z: scope.box.position.z,
            },
            scale: {
                x: scope.box.scale.x,
                y: scope.box.scale.y,
                z: scope.box.scale.z,},
            rotation: {
                x: scope.box.rotation.x,
                y: scope.box.rotation.y,
                z: scope.box.rotation.z,}
        };

        scope.boxOp.translate_box(virtbox, 'x', delta.x/2 * direction.x);
        scope.boxOp.translate_box(virtbox, 'y', delta.y/2 * direction.y);
        scope.boxOp.translate_box(virtbox, 'z', delta.z/2 * direction.z);

        virtbox.scale.x += delta.x;
        virtbox.scale.y += delta.y;
        virtbox.scale.z += delta.z;


        // note dim is the relative value
        let new_dim = scope.box.world.lidar.get_points_dimmension_of_box(virtbox, use_box_bottom_as_limit);


        for (var axis in direction){

            if (direction[axis] !=0){

                var end = "max";
                if (direction[axis] === -1){
                    end = "min";
                }

                //scope.box.scale[axis]/2 - direction[axis]*extreme[end][axis];
                var truedelta = delta[axis]/2 + direction[axis]*new_dim[end][axis] - scope.box.scale[axis]/2;

                console.log(new_dim, delta);
                scope.boxOp.translate_box(scope.box, axis, direction[axis]* truedelta );
                //scope.box.scale[axis] -= delta;
            }
        }

        scope.on_box_changed(scope.box);
    }

    function on_edge_changed(delta, direction){
        console.log(delta);

        scope.boxOp.translate_box(scope.box, 'x', delta.x/2 * direction.x);
        scope.boxOp.translate_box(scope.box, 'y', delta.y/2 * direction.y);
        scope.boxOp.translate_box(scope.box, 'z', delta.z/2 * direction.z);

        scope.box.scale.x += delta.x;
        scope.box.scale.y += delta.y;
        scope.box.scale.z += delta.z;
        scope.on_box_changed(scope.box);
    }


    function get_wheel_multiplier(wheel_direction){
        var multiplier = 1.0;
        if (wheel_direction > 0){
            multiplier = 1.1;
        } else {
            multiplier = 0.9;
        }
        return multiplier;
    }


    ///////////////////////////////////////////////////////////////////////////////////
    // direction is null if triggered by dbclick on 'move' handler 
    function on_z_auto_shrink(direction){
        var  extreme = scope.box.world.lidar.get_points_dimmension_of_box(scope.box, true);
        
        if (!direction){
            ['x','y'].forEach(function(axis){

                scope.boxOp.translate_box(scope.box, axis, (extreme.max[axis] + extreme.min[axis])/2);
                scope.box.scale[axis] = extreme.max[axis] - extreme.min[axis];        
    
            })
        } else{
            direction = {
                x: direction.y,
                y: -direction.x,
                z: 0,
            }

            auto_shrink(extreme, direction)
        }
        
        scope.on_box_changed(scope.box);
    }

      
    function on_z_edge_changed(ratio, direction2d, autoShrink, lockScale){

        var delta = {        
            x: scope.box.scale.x * ratio.y * direction2d.y,
            y: scope.box.scale.y * ratio.x * direction2d.x,
            z: 0,
        };

        let direction3d ={
            x: direction2d.y,
            y: -direction2d.x,
            z: 0,
        };

        if (!autoShrink && !lockScale){
            on_edge_changed(delta, direction3d);
        } else if (autoShrink){
            on_edge_changed(delta, direction3d);
            on_z_auto_shrink(direction2d);
        } else if (lockScale){
            auto_stick(delta, direction3d, true);
        }
    }

    function on_z_direction_changed(theta, sticky){
        // points indices shall be obtained before rotation.
        let box = scope.box;
        scope.boxOp.rotate_z(box, theta, sticky)
        scope.on_box_changed(box);
    }


    //ratio.y  vertical
    //ratio.x  horizental
    // box.x  vertical
    // box.y  horizental

    function limit_move_step(v, min_abs_v)
    {
        if (v < 0)
            return Math.min(v, -min_abs_v)
        else if (v > 0)
            return Math.max(v, min_abs_v)
        else
            return v;
    }

    function on_z_moved(ratio){
        let delta = {        
            x:  scope.box.scale.x*ratio.y,
            y: -scope.box.scale.y*ratio.x,
        };

        delta.x = limit_move_step(delta.x, 0.02);
        delta.y = limit_move_step(delta.y, 0.02);
        
        scope.boxOp.translate_box(scope.box, "x", delta.x);
        scope.boxOp.translate_box(scope.box, "y", delta.y);

        scope.on_box_changed(scope.box);
    }


    function on_z_scaled(ratio){
            
        ratio = {
            x: ratio.y,
            y: ratio.x,
            z: 0,
        };

        for (var axis in ratio){
            if (ratio[axis] != 0){
                scope.box.scale[axis] *= 1+ratio[axis];
            }
        }
        
        scope.on_box_changed(scope.box);
    }

    function on_z_wheel(wheel_direction){
        let multiplier = get_wheel_multiplier(wheel_direction);
        let newRatio = scope.views[0].zoom_ratio *= multiplier;
        scope.boxEditor.updateViewZoomRatio(0, newRatio);
        //z_view_handle.update_view_handle(scope.views[0].getViewPort(), {x: scope.box.scale.y, y:scope.box.scale.x});
    }

    function on_z_fit_size(noscaling){
        if (noscaling)
        {
            // fit position only
            scope.boxOp.auto_rotate_xyz(scope.box, null, 
                {x:true, y:true, z:false}, 
                scope.on_box_changed, noscaling, "dontrotate");
        }
        else
        {
            scope.boxOp.fit_size(scope.box, ['x','y']);
            scope.on_box_changed(scope.box);
        }
        
    }

    function on_z_auto_rotate(noscaling, rotate_method){

        if (rotate_method == "moving-direction")
        {
            let estimatedRot = scope.boxOp.estimate_rotation_by_moving_direciton(scope.box);

            if (estimatedRot)
            {
                scope.box.rotation.z = estimatedRot.z;
                scope.on_box_changed(scope.box);
            }        
        }
        else{
            scope.boxOp.auto_rotate_xyz(scope.box, null, 
                noscaling?null:{x:false, y:false, z:true}, 
                scope.on_box_changed, noscaling);
        }
        
    }

    function on_z_reset_rotate(){
        scope.box.rotation.z = 0;
        scope.on_box_changed(scope.box);
    }

    var z_view_handle = create_view_handler(scope.ui.querySelector("#z-view-manipulator"), 
                                           on_z_edge_changed, 
                                           on_z_direction_changed, 
                                           on_z_auto_shrink, 
                                           on_z_moved, 
                                           on_z_scaled, 
                                           on_z_wheel, 
                                           on_z_fit_size, 
                                           on_z_auto_rotate, 
                                           on_z_reset_rotate);


    ///////////////////////////////////////////////////////////////////////////////////

    function on_y_edge_changed(ratio, direction2d, autoShrink, lockScale){

        var delta = {
            x: scope.box.scale.x * ratio.x * direction2d.x,
            z: scope.box.scale.z * ratio.y * direction2d.y,
            y: 0,
        };

        let direction3d ={
            x: direction2d.x,
            z: direction2d.y,
            y: 0,
        };

        if (!autoShrink && !lockScale){
            on_edge_changed(delta, direction3d);
        } else if (autoShrink){
            on_edge_changed(delta, direction3d);
            on_y_auto_shrink(direction2d);
        } else if (lockScale){
            auto_stick(delta, direction3d, direction2d.y===0);
        }
    }

    function on_y_auto_shrink(direction){
        
        
        if (!direction){
            var  extreme = scope.box.world.lidar.get_points_dimmension_of_box(scope.box, false);
            ['x','z'].forEach(function(axis){

                scope.boxOp.translate_box(scope.box, axis, (extreme.max[axis] + extreme.min[axis])/2);
                scope.box.scale[axis] = extreme.max[axis]-extreme.min[axis];        
    
            })       
            

        } else{
            direction = {
                x: direction.x,
                y: 0,
                z: direction.y,
            }

            if (direction.z != 0){
                var  extreme = scope.box.world.lidar.get_points_dimmension_of_box(scope.box, false);
                auto_shrink(extreme, direction)
            }else {
                var  extreme = scope.box.world.lidar.get_points_dimmension_of_box(scope.box, true);
                auto_shrink(extreme, direction)
            }
            
        }
        
        scope.on_box_changed(scope.box);
    }


    function on_y_moved(ratio){
        var delta = {
            x: limit_move_step(scope.box.scale.x*ratio.x, 0.02),
            z: limit_move_step(scope.box.scale.z*ratio.y,0.02),
        };

        
        scope.boxOp.translate_box(scope.box, "x", delta.x);
        scope.boxOp.translate_box(scope.box, "z", delta.z);

        scope.on_box_changed(scope.box);
    }

    function on_y_direction_changed(theta, sticky){
        scope.boxOp.change_rotation_y(scope.box, theta, sticky, scope.on_box_changed)
    }


    function on_y_scaled(ratio){
        
        ratio = {
            x: ratio.x,
            y: 0,
            z: ratio.y,
        };

        for (var axis in ratio){
            if (ratio[axis] != 0){
                scope.box.scale[axis] *= 1+ratio[axis];
            }
        }
        
        scope.on_box_changed(scope.box);
    }

    function on_y_wheel(wheel_direction){
        let multiplier = get_wheel_multiplier(wheel_direction);        
        let newRatio = scope.views[1].zoom_ratio *= multiplier;
        scope.boxEditor.updateViewZoomRatio(1, newRatio);
    }

    function on_y_reset_rotate(){
        scope.box.rotation.y = 0;
        scope.on_box_changed(scope.box);
    }

    function on_y_auto_rotate(){
        scope.boxOp.auto_rotate_y(scope.box, scope.on_box_changed);
    }

    var y_view_handle = create_view_handler(scope.ui.querySelector("#y-view-manipulator"), on_y_edge_changed, 
                                                on_y_direction_changed, on_y_auto_shrink, on_y_moved, on_y_scaled, on_y_wheel, 
                                                null,
                                                on_y_auto_rotate,
                                                on_y_reset_rotate);


    ///////////////////////////////////////////////////////////////////////////////////

    function on_x_edge_changed(ratio, direction2d, autoShrink, lockScale){

        var delta = {
            y: scope.box.scale.y * ratio.x * direction2d.x,
            z: scope.box.scale.z * ratio.y * direction2d.y,
            x: 0,
        };

        let direction3d ={
            y: -direction2d.x,
            z: direction2d.y,
            x: 0,
        };

        if (!autoShrink && !lockScale){
            on_edge_changed(delta, direction3d);
        } else if (autoShrink){
            on_edge_changed(delta, direction3d);
            on_x_auto_shrink(direction2d);
        } else if (lockScale){
            auto_stick(delta, direction3d, direction2d.y===0);
        }
    }


    function on_x_auto_shrink(direction){
        if (!direction){
            var  extreme = scope.box.world.lidar.get_points_dimmension_of_box(scope.box, false);

            ['y','z'].forEach(function(axis){

                scope.boxOp.translate_box(scope.box, axis, (extreme.max[axis] + extreme.min[axis])/2);
                scope.box.scale[axis] = extreme.max[axis]-extreme.min[axis];        
    
            })       
            

        } else{
            direction = {
                x: 0,
                y: -direction.x,
                z: direction.y,
            }

            if (direction.z != 0){
                var  extreme = scope.box.world.lidar.get_points_dimmension_of_box(scope.box, false);
                auto_shrink(extreme, direction)
            } else {
                var  extreme = scope.box.world.lidar.get_points_dimmension_of_box(scope.box, true);
                auto_shrink(extreme, direction)
            }
        }
        
        scope.on_box_changed(scope.box);
    }


    function on_x_moved(ratio){
        var delta = {
            y: limit_move_step(scope.box.scale.y*(-ratio.x), 0.02),
            z: limit_move_step(scope.box.scale.z*ratio.y, 0.02),
        };

        
        scope.boxOp.translate_box(scope.box, "y", delta.y);
        scope.boxOp.translate_box(scope.box, "z", delta.z);

        scope.on_box_changed(scope.box);
    }

    function on_x_direction_changed(theta, sticky){
        scope.boxOp.change_rotation_x(scope.box, -theta, sticky, scope.on_box_changed)
    }

    function on_x_scaled(ratio){
        
        ratio = {
            y: ratio.x,
            z: ratio.y,
        };

        for (var axis in ratio){
            if (ratio[axis] != 0){
                scope.box.scale[axis] *= 1+ratio[axis];
            }
        }
        
        scope.on_box_changed(scope.box);
    }

    function on_x_wheel(wheel_direction){
        let multiplier = get_wheel_multiplier(wheel_direction);        
        let newRatio = scope.views[2].zoom_ratio *= multiplier;
        scope.boxEditor.updateViewZoomRatio(2, newRatio);
    }


    function on_x_reset_rotate(){
        scope.box.rotation.x = 0;
        scope.on_box_changed(scope.box);
    }

    function on_x_auto_rotate(){
        scope.boxOp.auto_rotate_x(scope.box, scope.on_box_changed);
    }

    var x_view_handle = create_view_handler(scope.ui.querySelector("#x-view-manipulator"), on_x_edge_changed, 
                                                on_x_direction_changed, 
                                                on_x_auto_shrink, 
                                                on_x_moved, 
                                                on_x_scaled, 
                                                on_x_wheel, 
                                                null,
                                                on_x_auto_rotate,
                                                on_x_reset_rotate);



    // exports

    this.box = undefined;
    this.attachBox = function(box){
        this.box = box;
        //this.show();
        this.showAllHandlers();
        this.update_view_handle(box);
    };
    this.detach = function(box){
        this.box = null;
        this.hideAllHandlers();
    };

    this.hideAllHandlers = function(){
        this.ui.querySelectorAll(".subview-svg").forEach(ui=>ui.style.display="none");
        //this.ui.querySelectorAll(".v-buttons-wrapper").forEach(ui=>ui.style.display="none");
    };

    this.showAllHandlers = function(){
        this.ui.querySelectorAll(".subview-svg").forEach(ui=>ui.style.display="");
        //this.ui.querySelectorAll(".v-buttons-wrapper").forEach(ui=>ui.style.display="");
    };


    // this.show = function(box){
    //     this.ui.style.display="block";
    // };

    // this.hide = function(){
    //     this.ui.style.display="none";
    // }

    this.init_view_operation = function(){
        z_view_handle.init_view_operation();
        y_view_handle.init_view_operation();
        x_view_handle.init_view_operation();
    };

    this.update_view_handle = function(){
        if (this.box){
            let boxPos = this.box.position;

            z_view_handle.update_view_handle(this.views[0].getViewPort(), {x: this.box.scale.y, y:this.box.scale.x}, {x: boxPos.x, y: boxPos.y}, this.box.rotation.z);
            y_view_handle.update_view_handle(this.views[1].getViewPort(), {x: this.box.scale.x, y:this.box.scale.z});
            x_view_handle.update_view_handle(this.views[2].getViewPort(), {x: this.box.scale.y, y:this.box.scale.z});
        }
    };

};

export {ProjectiveViewOps}
