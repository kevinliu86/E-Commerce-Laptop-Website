import re 


# unpack the dictionary
def unpack(data, *args, **kwargs):
    result = [data.get(arg, None) for arg in args]

    # check if all required
    if kwargs.get('required', False):
        for each in result:
            if each is None:
                return False, None 

    return True, result


def check_address(unit_number, street_number, street_name, suburb, postcode, state):
    # return flag for True, False
    if int(unit_number) < 0:
        return False, "Unit number should >= 0"
    
    if int(street_number) <= 0:
        return False, "Street number should > 0"

    if len(street_name) < 3 or len(street_name) > 50:
        return False, "Street name should between 3 and 50 chars"
    
    if len(suburb) < 3 or len(suburb) > 50:
        return False, "Suburb name should between 3 and 50 chars"
    
    if len(postcode) != 4 or re.match("^\d{4}$", postcode) is None:
        return False, "Postcode should be 4 numbers."

    state_list = ["WA", "TAS", "VIC", "ACT", "NT", "NSW", "QLD", "SA"]

    if state not in state_list:
        return False, "State is wrong"

    return True, None 


def check_name(*args):
    for arg in args:
        if len(arg) > 50 or len(arg) == 0:
            return False, "Name should be between 0 and 50 chars" 

    return True, None 


def check_mobile(mobile):
    if len(mobile) != 10 or re.match("^\d{10}$", mobile) is None:
        return False, "Mobile should be 10 digits"

    if mobile[:2] != '04':
        return False, "Mobile start with 04"
    
    return True, None 


def check_password(password):
    if len(password) < 6:
        return False, "Password should be > 6 chars"
    return True, None 


def check_email(email):
    if re.match("^\S+@\S+$", email) is None:
        return False, "Invalid format of email"
    return True, None


if __name__ == '__main__':
    """The following is some basic usage for the unpack function"""
    dict1 = {
        'first_name': 'sss',
        'last_name': 'xxx'
    }

    flag, result = unpack(dict1, "first_name", "last_name")

    print(flag)
    print(result)

    fn, ln = result 
    print(fn, ln)

    flag2, result2 = unpack(dict1, "first_name", "address")
    print(flag2, result2)

    flag3, result3 = unpack(dict1, "first_name", "address", required=True)
    print(flag3, result3)