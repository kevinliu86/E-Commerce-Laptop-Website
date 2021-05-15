import * as util from "./util.js";
import {navbar_set_up} from "./navbar.js";


util.addLoadEvent(navbar_set_up)


document.getElementById('submit-register').addEventListener('click',async () =>{

    // extract the values
    let firstname = document.getElementById('firstname-register').value;
    let lastname = document.getElementById('lastname-register').value;
    let email = document.getElementById('email-register').value;
    let mobile = document.getElementById('mobile-register').value;
    let pwd = document.getElementById('password-register').value;
    let pwd2 = document.getElementById('password-confirm-register').value;

    let unit_number = document.getElementById('unitNumber-register').value;
    let street_number = document.getElementById('streetNumber-register').value;
    let street_name = document.getElementById('street-register').value;
    let suburb = document.getElementById('suburb-register').value;
    let postcode = document.getElementById('postcode-register').value;
    let state = document.getElementById('state-register').value;

    // check null
    let is_null = firstname == "" || lastname == "" || email == "" || mobile == "" || pwd == "" || pwd2 == "";
    let is_null_2 = unit_number == "" || street_number == "" || street_name == "" || suburb == "" || postcode == "" || state == "";

    // check profile
    if (is_null || is_null_2){
        alert("Please fill all fields.");
        return;
    }

    if (firstname.length > 50){
        alert("Firstname length limit 50. ");
        return;
    }

    if (lastname.length > 50){
        alert("Lastname length limit 50.");
        return;
    }

    let re_email = /^[^\s@]+@[^\s@]+$/;
    if (! re_email.test(email)){
        alert("Invalid email format. Please check.");
        return;
    }

    let re_mobile = /^04\d{8}$/;
    if (! re_mobile.test(mobile)){
        alert("Invalid mobile format. The mobile should be 10 digits and start with 04");
        return;
    }

    if (pwd.length < 6){
        alert("Password should have at least 6 letters");
        return;
    }

    if (pwd !== pwd2){
        alert("Password not match");
        return;
    }

    // check address
    let re_num = /^\d+$/;
    let re_words = /^[a-zA-Z \']+$/

    if (! re_num.test(unit_number)){
        alert("Unit number must be an integer");
        return;
    }

    if (! re_num.test(street_number)){
        alert("Street number must be an integer");
        return;
    }

    if (! re_words.test(street_name)){
        alert("Street name is invalid. Please check");
        return;
    }

    if (! re_words.test(suburb)){
        alert("Suburb is invalid. Please check");
        return;
    }

    let re_postcode = /^\d{4}$/;
    if (! re_postcode.test(postcode)){
        alert("Postcode should be 4 digits only. Please check");
        return;
    }

    let re_state = /^(NSW|QLD|VIC|TAS|ACT|WA|NT|SA)$/;
    if (! re_state.test(state)){
        alert("State is invalid. Please check");
        return;
    }

    // finish check, prepare for fetch
    let registerBody = {
        "first_name": firstname,
        "last_name": lastname,
        "email": email,
        "mobile": mobile,
        "password": pwd,
        "address":{
          "unit_number": unit_number,
          "street_number": street_number,
          "street_name": street_name,
          "suburb": suburb,
          "postcode": postcode,
          "state": state
        }
    }

    let url = 'http://localhost:5000/auth/signup';

    let init = {
        method: 'POST',
        headers: {
            'Accept':'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(registerBody)
    };

    try{
        let response = await fetch(url, init);

        if (response.ok){
            let data = await response.json();

            sessionStorage.setItem("token", data['token']);
            sessionStorage.setItem("role", data['role']);
            
            alert("Welcome customer !!");

            window.location.href = "index.html";
        }
        else if (response.status == 409){
            alert("Sorry. The email address is taken already. Please try another one.");
            return;
        }
        else if (response.status == 400){
            let txt = await response.text();
            alert("Invalid form " + txt);
        }
    }
    catch(err){
        alert("error");
        console.log(err);
    }
});