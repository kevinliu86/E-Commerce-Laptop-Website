import * as modal from "./modal.js";


export function appendListChild(node, nodeList){
    if (! Array.isArray(nodeList)){
        console.log("wrong input");
        console.log(node);
        console.log(nodeList);
        return;
    }

    if (node == null){
        console.log("first parameter is null");
        return;
    }

    for (let i = 0; i < nodeList.length; i++){
        node.appendChild(nodeList[i]);
    }

    return;
}


export function removeAllChild(node){
    if (node != null){
        while (node.firstChild){
            node.removeChild(node.lastChild);
        }
    }

    return;
}


export function removeSelf(node){
    if (node === null){
        alert("Wrong input");
        return;
    }

    node.parentNode.removeChild(node);
    return;
}


// use this to add multiple onload function
export function addLoadEvent(new_load_func){
    let old_load_func = window.onload;

    if (typeof window.onload != 'function'){
        window.onload = new_load_func;
    }
    else{
        window.onload = function(){
            old_load_func();
            new_load_func();
        }
    }
}


// check admin
export function check_admin(){
    return sessionStorage.getItem("token") && (sessionStorage.getItem("role") == 0);
}


export function createMaterialIcon(tag, content){
    let i = document.createElement(tag);
    i.classList.add("material-icons");
    i.textContent = content;
    return i;
}


/**
 * Given a js file object representing a jpg or png image, such as one taken
 * from a html file input element, return a promise which resolves to the file
 * data as a data url.
 * @param {File} file The file to be read.
 * @return {Promise<string>} Promise which resolves to the file as a data url.
 */
 export function fileToDataUrl(file) {
    // const validFileTypes = [ 'image/jpeg', 'image/png', 'image/jpg' ]
    // const valid = validFileTypes.find(type => type === file.type);
    // // Bad data, let's walk away.
    // if (!valid) {
    //     throw Error('provided file is not a png, jpg or jpeg image.');
    // }
    
    const reader = new FileReader();
    const dataUrlPromise = new Promise((resolve,reject) => {
        reader.onerror = reject;
        reader.onload = () => resolve(reader.result);
    });
    reader.readAsDataURL(file);
    return dataUrlPromise;
}


export function form_full_address_text(data){
    let text = "";

    if (data['unit_number'] !== 0){
        text = `Unit ${data['unit_number']}, `;
    }

    text += `No.${data['street_number']} ${data['street_name']} ${data['postcode']} ${data['state']}`;

    return text;
}



