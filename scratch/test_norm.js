function normalize(name) {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/(.)\1+/g, '$1');
}

console.log(normalize("National Institute of Technology Tiruchirappalli"));
console.log(normalize("National Institute of Technology, Tiruchirapalli"));
