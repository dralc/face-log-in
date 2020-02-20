var returnOrign = 'http://localhost:5000/',
    domain = 'localhost',
    auth;

setCookie = function(key, value, hours, domain) {

    // set cookie
    hours = (isNaN(parseInt(hours, 10))) ? 1 : hours;
    var now = new Date(),
        addHours = (parseInt(hours, 10) * 60 * 60 * 1000);

    now.setTime(now.getTime() + addHours);
    var expires = ';expires=' + now.toGMTString();

    return (document.cookie = key + '=' + encodeURI(value) + ';domain=' + domain + ';path=/' + expires);
};

auth = function(ev) {
    if(ev.detail.isAuth) {
        document.getElementById('AuthElement').removeEventListener('authEvent', auth);
        
        setCookie('logged-in-profile', ev.detail.name, 24, domain);
        
        setTimeout(function(){ 
            window.location.href = returnOrign;
        }, 2000);
    }
};

document.getElementById('AuthElement').addEventListener('authEvent', auth);
