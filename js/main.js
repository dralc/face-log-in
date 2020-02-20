const MODEL_URL = '/models'
const input = document.getElementById('myVideo')
const useCam = /VIDEO/i.test(input.tagName);
const canvas = document.getElementById('myCanvas')
const labels = ['aloysius']
const maxDescriptorDistance = 0.4 // 0.6 is a good distance threshold value to judge whether the descriptors match or not
const detectOpts = new faceapi.TinyFaceDetectorOptions({ inputSize: 128 }) // { inputSize: 160 | 320 | 416 | 512, scoreThreshold: 0.5 }
const drawDetections = false;
const drawMatches = true;
const authElement = document.getElementById('AuthElement');
const AUTH_EVENT = 'authEvent';
let modelsLoaded = false;
const imgTick = document.querySelector('.tick');

/**
 * 
 */
async function loadModels() {
    // await faceapi.loadSsdMobilenetv1Model(MODEL_URL)
    await faceapi.loadTinyFaceDetectorModel(MODEL_URL)
    await faceapi.loadFaceLandmarkModel(MODEL_URL)
    await faceapi.loadFaceRecognitionModel(MODEL_URL)

    modelsLoaded = true;
}

let parsedReferenceData = false;
let labeledFaceDescriptors;
/**
 * Match faces in input with the reference data
 * 
 * @return {Array<Object>} Array of FaceMatch
 */
async function faceRecog (fullFaceDescriptions) {
    if (!parsedReferenceData) {

        labeledFaceDescriptors =  await Promise.all(
            
            // Returns Array<Promise(faceDescriptor)>
            labels.map(async label => {
                // Load reference image and convert blob into Image element
                const img = await faceapi.fetchImage( `reference-data/${label}.jpg` )
                
                // detect the face with the highest score in the image and compute it's landmarks and face descriptor
                const fullFaceDescription = await faceapi.detectSingleFace(img, detectOpts).withFaceLandmarks().withFaceDescriptor()
                
                if (!fullFaceDescription) {
                    throw new Error(`no faces detected for ${label}`)
                }
                
                const faceDescriptors = [ fullFaceDescription.descriptor ]
                return new faceapi.LabeledFaceDescriptors(label, faceDescriptors)
            })
        )
        parsedReferenceData = true;
    }
            
    const faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, maxDescriptorDistance)

    return fullFaceDescriptions.map(fd => faceMatcher.findBestMatch(fd.descriptor))
}

/**
 * Detect faces in the desired input image
 * 
 * @param {*} input Image Element, canvas or video too ?
 * @param {Boolean} drawDetections
 * 
 * @return {Promise<Array>} fullFaceDescriptions
 */
async function faceDetect(input, drawDetections) {
    let fullFaceDescriptions = await faceapi.detectAllFaces(input, detectOpts).withFaceLandmarks().withFaceDescriptors()

    // Make the dimensions of the face descriptions canvas and input image equal
    canvas.width = input.width
    canvas.height = input.height
    
    // Also re-size the face descriptions in the canvas
    fullFaceDescriptions = fullFaceDescriptions.map(fd => fd.forSize(input.width, input.height))
    
    if (drawDetections) {
        
        const detectionsArray = fullFaceDescriptions.map(fd => fd.detection)
        faceapi.drawDetection(canvas, detectionsArray, { withScore: true })
        
        const landmarksArray = fullFaceDescriptions.map(fd => fd.landmarks)
        faceapi.drawLandmarks(canvas, landmarksArray, { drawLines: true })
    }

    return fullFaceDescriptions
}

async function onPlay() {
    // const fullFaceDescriptions = await faceDetect(input, drawDetections);
    if (!modelsLoaded)
        return setTimeout(onPlay)
    
    await main();
    
    setTimeout(onPlay);
}

async function main() {
    const fullFaceDescriptions = await faceDetect(input);
    const faceMatches = await faceRecog(fullFaceDescriptions);

    if (drawMatches) {
        const boxesWithText = faceMatches.map((bestMatch, i) => {
            const box = fullFaceDescriptions[i].detection.box
            const text = bestMatch.toString()
            return new faceapi.BoxWithText(box, text)
        })
      
        faceapi.drawDetection(canvas, boxesWithText)
    }

    // Notify facial authorisation
    const founds = faceMatches.reduce((acc, match) => {
        // Keep recognisable faces
        const label = match.toString();
        if ( ! /unknown/i.test(label) ) {
            acc.push(match);
        }
        return acc;
    }, []);

    const payload = {
        isAuth: founds.length >= 1,
        name: (founds.length >=1) ? founds[0].label : 'unknown'
    }

    // UX auth success feedback
    if (payload.isAuth) {
        imgTick.classList.add(['zoom'])
    } else {
        imgTick.classList.remove(['zoom'])
    }

    authElement.dispatchEvent( new CustomEvent(AUTH_EVENT, { detail: payload } ) );
}

if (useCam) {
    // Get user camera stream
    navigator.mediaDevices.getUserMedia({ video: true })
    .then(async (stream) => {
        input.srcObject = stream
        await loadModels();
        main();
    })
    .catch((er) => console.log(er))
} else {
    (async () => await loadModels())()
    main();
}


// Debug event emission
const urlParams = new URLSearchParams(window.location.search);
const isDebug = urlParams.get('debug');
if (isDebug) {
    authElement.addEventListener(AUTH_EVENT, (ev) => {
        console.log(ev.detail)
    })
}