# MCU Management API
---
# 1 Introduction
Intel WebRTC solution provides a set of REST (Representational State Transfer) API for conference management. Manager clients can be implemented by different programming languages through these APIs.
# 2 Definitions
Resource: the kind of data under manipulation
Verb: HTTP verb. The mapping to operations is as following:

    - Create operations: POST
    - Read operations: GET
    - Update operations(entirely): PUT
    - Update operations(partially): PATCH
    - Delete operations: DELETE
URI: the Universal Resource Identifier, or name through which the resource can be manipulated.

Request Body: the request data that user need supply to call the API. Json format data is requried.

Response Body: the response data is returned through HTTP response in JSON/text format.

# 3 Making a Call {#MAKINGACALL}
With all the management API, perform the following steps to implement each call.

1. Create a string for the http request that consist of the format [HTTP verb][url] + [headers] + [request body](optional)
2. Use your preferred language's network library (or http library) to send the request to REST server.
3. For authentication, REST API accept HTTP authentication on each request, see **section 4**(Authentication and Authorization) for details.
4. Read the response in your programming language, and parse the response JSON data.
5. Use the data in your application.

The following HTTP response may be returned after your make a call:

    - 200 - OK. Some calls return with a JSON format response while some calls return a plain text response indicates success.
    - 401 - Not authenticated or permitted.
    - 404 - NOT found or no such resource.

# 4 Authentication and Authorization {#RESTAPIsection3}
The management API can only be called after authorized. To get authorized, each request should be a HTTP request with "Authorization" filed in the header. So the server can determine whether it is a valid client. The value of "Authorization" is something like:

    MAuth realm=http://webrtc.intel.com,
    mauth_signature_method=HMAC_SHA256,
    mauth_username=test,
    mauth_role=role,
    mauth_serviceid=53c74879209ee7f96e5cbc9c,
    mauth_cnonce=87428,
    mauth_timestamp=1406079112038,
    mauth_signature=ZjA5NTJlMjE0ZTY4NzhmZWRjZDkxYjNmZjkyOTIxYzMyZjg3NDBjZA==
- Mauth realm=http://webrtc.intel.com, mauth_signature_method=HMAC_SHA256
- mauth_username and mauth_role are optional.
- mauth_serviceid is the ID of the service.
- mauth_cnonce is a random value between 0 and 99999.
- mauth_timestamp is the timestamp of the request.
- mauth_signature is a signature of this request. It uses HMAC_SHA256 to sign timestamp, cnonce, username(optional), role(optional) with service key. Then encrypted it with BASE64.

Example of encryption algorithm (python):

    {.py}

    from hashlib import HMAC_SHA256
    import hmac
    import binascii

    toSign = str(timestamp) + ',' + str(cnonce)
    if (username != '' and role != ''):
        toSign += ',' + username + ',' + role
    signed = self.calculateSignature(toSign, key)
    def calculateSignature(toSign, key):
        hash = hmac.new(key, toSign, HMAC_SHA256)
        signed = binascii.b2a_base64(hash.hexdigest())[:-1]
        return signed
**toSign** is the signature.

**Note:**<br>
If authentication failed, a response with code 401 would be returned.
# 5 Management Resource {#RESTAPIsection5}
The management API uses REST model to accessing different resources. The resources in conference management can be grouped into 7 kinds:

- Rooms
- Participants
- Streams
- Streaming-ins
- Streaming-outs
- Recordings
- Token

## 5.1 Rooms
Description:<br>
　　A room is the conference where users can communicate by real-time video and audio. Rooms are served by services. These resources can only be accessed after authenticated to their owner services. Rooms can have different settings for various scenarios. Making call on room resources provides users the ability to customize rooms for different needs.

Data Model:<br>

    object(Room):
    {
      "_id": string,
      "name": string,
      "participantLimit": number,                // -1 means no limit
      "inputLimit": number,
      "roles": object(Role),
      "views": object(Views),
      "mediaIn": object(MeidaIn),
      "mediaOut": object(MediaOut),
      "transcoding": object(Transcoding),
      "notifying": object(Notifying),
      "sip": object(Sip)
    }
    object(Role): {
      'role': 'string',
      'publish': {
        'video': boolean,
        'audio': boolean
      },
      'subscirbe': {
        'video': boolean,
        'audio': boolean
      }
    }
    object(Views): {
      "label": string,
      "maxInput": number,
      "audio": object,
      "video": object,
    }
    object(Audio): {
      "format": {
        "codec": string,                     // 'opus', 'pcmu', 'pcma', 'aac', 'ac3', 'nellymoser'
        "sampleRate": number,
        "channelNum": number
      },
      "vad": boolean
    }
    object(Video):{
      "format": {
        "codec": string,                    // 'h264', 'vp8', 'h265', 'vp9'
      },
      "parameters": {
        "resolution": string,
        "framerate": number,
        "bitrate": string,
        "keyFrameInterval": number
      },
      "bgColor": {
        "r": 0 ~ 255,
        "g": 0 ~ 255,
        "b": 0 ~ 255
      },
      "motionfactor": number,
      "keepActiveInputPrimay": boolean,
      "layout": {
        "fitPilicy": string,                  // 'letterbox' or 'crop'.
        "templates": {
          "base": string,                     // valid values ["fluid", "lecture", "void"].
          "custom": [
            { "primary": string, "region": object},
            { "primary": string, "region": object}
          ]
         }
      }
    }
    object(Region): {
      "id": string,
      "shape": string,
      "area": {
        "left": number,
        "top": number,
        "width": number,
        "height": number
      }
    }
    object(MeidaIn): {
      "audio": object，
      "video": object
    }
    object(MediaOut): {
      "audio": object,
      "video": object,
      "parameters": {
        "resolution": array,                 // Array of resolution.E.g. ['x3/4', 'x2/3', ... 'cif']
        "framerate": array,                  // Array of framerate.E.g. [5, 15, 24, 30, 48, 60]
        "bitrate": array,                    // Array of bitrate.E.g. ['x1.6', ... , '0.4']
        "keyFrameInterval": array            // Array of keyFrameInterval.E.g. [100, 30, 5, 2, 1]
      }
    }
    object(Transcoding): {
      "audio": boolean,
      "video": {
        "format": boolean,
        "framerate": boolean,
        "bitrate": boolean,
        "keyFrameInterval": boolean
      }
    }
    object(Notifying): {
      "participantActivities": boolean,
      "streamChange": boolean
    }
    object(Sip): {
      "sipServer": string,
      "username": string,
      "password": string
    }
Resources:<br>

- /v1/rooms/
- /v1/rooms/{roomId}

### /v1/rooms
#### POST
Description:<br>
　　This function can create a room.

parameters:

| parameters |   type   | annotation |
| :----------:|:------:|:------------------:|
| roomConfig | request body | Configuration used to create room |

This is for *roomConfig*:

    object(RoomConfig):
    {
        name:name,
        options: object(Room)                  // Refers to room data model listed above.
    }
response body:

| type | content |
|:-------------:|:-------:|
|      json     |  A room data model represents the room created |
#### GET
Description:<br>
　　List the rooms in your service.

parameters:

| parameters | type | annotation |
|:----------:|:----:|:----------:|
|    null    | null |    null    |

response body:

| type | content |
|:-------------:|:-------:|
|      json     | List of room data |

Here is an example of json data:

    [room0, room1, ...]
**Note**: Elements in list are of room data model.

Pagination

Requests that return multiple rooms will not be paginated by default. To avoid too much data of one call, you can set a custom page size with the ?per_page parameter.You can also specify further pages with the ?page parameter.

GET 'https://sample.api/service?page=2&per_page=10'

Note that page numbering is 1-based and that omitting the ?page parameter will return the first page.

### /v1/rooms/{roomId}
#### GET
Description:<br>
　　Get information on the specified room.

parameters:

| parameters | type | annotation |
|:----------:|:----:|:----------:|
|    {roomId}    | URL |    Room ID    |
| undefined | request body | Request body is null |
response body:

| type | content |
|:-------------:|:-------:|
|      json     | The required room data model |
#### DELETE
Description:<br>
　　Delete the specified room.

parameters:

| parameters | type | annotation |
|:----------:|:----:|:----------:|
|    {roomId}    | URL |    Room ID to be deleted   |
| undefined | request body| Request body is null |
response body:

| type | content |
|:-------------:|:-------:|
|      text     | A text message "Room deleted" indicates success |
#### PUT
Description:<br>
　　Update a room's configuration entirely.

parameters:

| parameters | type | annotation |
|:----------:|:----:|:----------:|
|    {roomId}    | URL |    Room ID    |
|  options or {}  | request body | Room configuration|
**Note**: *options* is same as *object(Options)* in 5.1, /v1/rooms/POST.

response body:

| type | content |
|:-------------:|:-------:|
|      json     | The updated room data model |
#### PATCH
Description:<br>
　　update a room's configuration partially.

parameters:

| parameters | type | annotation |
|:----------:|:----:|:----------:|
|    {roomId}    | URL |    Room ID    |
|   items  | request body | Configuration item list to be updated|
**Note**:<br>
　　The detail format for items can be found in ``https://tools.ietf.org/html/rfc6902``. Here is a model for one item.

    items=[
        {
            op: string,
            path: string,
            value: json
        }
    ]
response body:

| type | content |
|:-------------:|:-------:|
|      json     | The updated room data model |
## 5.2 Participants
Description:

ParticipantDetail model:

    object(Permission)：
    {
        publish: {
            audio: true | false,
            video: true | false
        } | false,
        subscribe: {
            type: ["webrtc" | "recording" | "streaming"],
            media: {
                audio: true | false,
                video: true | false
            }
        } | false
    }
    object(ParticipantDeatil):
    {
        id: string(ParticipantId),
        role: string(participantRole),
        user: string(userId),
        permission: object(Permission),
        published: Array.<{id: string, type: string}>
        subscribed: Array.<{id: string, type: string}>
    }
Resources:

- /v1/rooms/{roomId}/participants
- /v1/rooms/{roomId}/participants/{participantId}

### /v1/rooms/{roomId}/participants
#### GET
Description:<br>
　　List participants currently in the specified room.

parameters:

| parameters | type | annotation |
|:----------:|:----:|:----------:|
|    {roomId}    | URL |    Room ID    |
| undefined  | request body | Request body is null |
response body:

| type | content |
|:-------------:|:-------:|
|      json     | All participants in the specified room |
### /v1/rooms/{roomId}/participants/{participantId}
#### GET
Description:<br>
　　Get a participant's information from the specified room.

parameters:

| parameters | type | annotation |
|:----------:|:----:|:----------:|
|    {roomId}    | URL |    Room ID    |
| {participantId} | URL | Participant ID|
|  undefined | request body | Request body is null |
response body:

| type | content |
|:-------------:|:-------:|
|      json     | The detail information of the specified participant |
#### PATCH
Description:<br>
　　Update the permission of a participant in the specified room.

parameters:

| parameters | type | annotation |
|:----------:|:----:|:----------:|
|    {roomId}    | URL |    Room ID    |
| {participantId}| URL | Participant ID|
| items| request body | Permission item list to be updated|
**Note**: This is the definition of *items*.<br>

    items=[
        object(PermissionUpdate)
    ]
    object(PermissionUpdate):
    {
        op: 'replace',

        // There are two kind of path and value. Choose one of them.

        path: '/permission/[publish|subscribe]',
        value: object(value)
          OR
        path: '/permission/[publish|subscribe]/[video|audio]',
        value: boolean
    }
    object(value):
    {
        audio: boolean,
        video: boolean
    }
response body:

| type | content |
|:-------------:|:-------:|
|      json     | The updated permission information of the specified participant |
#### DELETE
Description:<br>
　　Drop a participant from a room.

parameters:

| parameters | type | annotation |
|:----------:|:----:|:----------:|
|    {roomId}    | URL |    Room ID    |
| {participantId} | URL | Participant ID|
|  undefined | request body | Request body is null |

response body:

| type | content |
|:-------------:|:-------:|
|      text     | A message "participant's ID deleted" indicates success |
## 5.3 Streams
Description:

Streams model:

    object(StreamInfo):
    {
        id: string(StreamID),
        type: "streaming",
        media: object(MediaInfo)
    }
    object(MediaInfo):
    {
        audio: object(AudioInfo) | false,
        video: object(VideoInfo) | false
    }
    object(AudioInfo):
    {
        from: string,
        format: object(AudioFormat)
    }
    object(AudioFormat):
    {
        codec: "pcmu" | "pcma" | "opus" | "g722" | "iSAC" | "iLBC" | "aac" | "ac3" | "nellymoser",
        sampleRate: number,                     // Optional
        channelNum: number                      // Optional
    }
    object(VideoInfo):
    {
        from: string,
        format: object(VideoFormat),
        parameters: object(VideoParameters)
    }
    object(VideoFormat):
    {
         codec: "h264" | "h265" | "vp8" | "vp9",
         profile: "baseline" | "constrained-baseline" | "main" | "high" //If codec equals "h264".
    }
    object(VideoParameters):
    {
        resolution: object(Resolution) | undefined,
        framerate: number,
        bitrate: number | string,
        keyFrameInterval: number
    }
    object(Resolution):
    {
        width: number,
        height: number
    }
Resources:

- /v1/rooms/{roomId}/streams
- /v1/rooms/{roomId}/streams/{streamId}

### /v1/rooms/{roomId}/streams
#### GET
Description:<br>
　　List streams in the specified room.

parameters:

| parameters | type | annotation |
|:----------:|:----:|:----------:|
|    {roomId}    | URL |    Room ID    |
| undefined | request body | Request body is null |

response body:

| type | content |
|:-------------:|:-------:|
|      json     | All streams in the specified room |
### /v1/rooms/{roomId}/streams/{streamId}
#### GET
Description:<br>
　　Get a stream's information from the specified room.

parameters:

| parameters | type | annotation |
|:----------:|:----:|:----------:|
|    {roomId}    | URL |    Room ID    |
|    {streamId}  | URL |   Stream ID   |
| undefined | request body | Request body is null |
response body:

| type | content |
|:-------------:|:-------:|
|      json     | A stream's information in the specified room |
#### PATCH
Description:<br>
　　Update a stream's given attributes in the specified room.

parameters:

| parameters | type | annotation |
|:----------:|:----:|:----------:|
|    {roomId}    | URL |    Room ID    |
|    {streamId}  | URL |   Stream ID   |
|    items   | request body | An array with attributes to be updated|
**Note**: Here is a definition of *items*.<br>

    items=[
        object(StreamInfoUpdate)
    ]
    object(StreamInfoUpdate):
    {
        // There are three kind of op, path, value. Choose one of them.

        op: 'add' | 'remove',
        path: '/info/inViews',
        value: string
         OR
        op: 'replace',
        path: '/media/audio/status' | '/media/video/status',
        value: 'active' | 'inactive'
         OR
        op: 'replace',
        path: '/info/layout/[0-9]+/stream',     // '/info/layout/[0-9]+/stream' is a pattern to match the needed path.
        value: string
    }
response body:

| type | content |
|:-------------:|:-------:|
|      json     | A stream's updated information in the specified room |
#### DELETE
Description:<br>
　　Delete the specified stream from the specified room.

parameters:

| parameters | type | annotation |
|:----------:|:----:|:----------:|
|    {roomId}    | URL |    Room ID    |
|    {streamId}  | URL |   Stream ID   |
| undefined | request body | Request body is null |
response body:

| type | content |
|:-------------:|:-------:|
|  text | A message "Stream ID deleted" indicates success |
## 5.4 Streaming-ins
Description:

Streaming-ins model:

    object(Streaming-Ins):
    {
        room: roomID,
        url: URL,                   // String type.
        transport: object(Transport),
        media: object(Media)
    }
    object(Transport):
    {
        protocol: 'udp' | 'tcp',    // 'tcp' by default.
        buffersize: number          // The buffer size in bytes in case 'udp' is specified, 8192 by default.
    }
    object(Media):
    {
        audio: 'auto' | boolean,    // If audio is required, 'auto' or true or false, 'auto' by default.
        video: 'auto' | boolean     // If video is required, 'auto' or true or false, 'auto' by default.
    }
Resources:

- /v1/rooms/{roomId}/streaming-ins
- /v1/rooms/{roomId}/streaming-ins/{streamId}

### /v1/rooms/{roomId}/streaming-ins
#### POST
Description:<br>
　　Add an external RTSP/RTMP stream to the specified room.

parameters:

| parameters | type | annotation |
|:----------:|:----:|:----------:|
|    {roomId}    | URL |    Room ID    |
| pub_req | request body | Json format data with connection and media |

**Note**:

    pub_req={
        object(Connection),
        media: object(Media)        // Refers to object(Media) in 5.4 streaming-ins model.
    }
    object(Connection):
    {
        url: string,
        object(Transport)       // Refers to object(Transport) in 5.4 streaming-ins model.
    }
response body:

| type | content |
|:-------------:|:-------:|
|  json | The detail information of the external RTSP/RTMP stream |
### /v1/rooms/{roomId}/streaming-ins/{streamId}
#### DELETE
Description:<br>
　　Stop the specified external streaming-in in the specified room.

parameters:

| parameters | type | annotation |
|:----------:|:----:|:----------:|
|    {roomId}    | URL |    Room ID    |
|    {streamId}  | URL |   Stream ID   |
|   undefined | request body | Request body is null |
response body:

| type | content |
|:-------------:|:-------:|
|  text | A message "External streaming-in stopped" indicates success |
## 5.5 Streaming-outs
Description:

Streaming-outs model:

    object(Streaming-Outs):
    {
        streamingOut: Array.<{id: string, url: string, media: Object}>,
        streamingOutList: object(MediaSubOptions)
    }
    object(MediaSubOptions):
    {
        audio: object(AudioSubOptions) | false,
        video: object(VideoSubOptions) | false
    }
    object(AudioSubOptions):
    {
        from: string(StreamId),
        format: object(AudioFormat)      // Refers to object(AudioFormat) in 5.3, streams data model.
    }
    object(VideoSubOptions):
    {
        from: string(StreamId),
        format: object(VideoFormat),     // Refers to object(VideoFormat) in 5.3, streams data model.
        parameters: object(VideoParametersSpecification)
    }
    object(VideoParametersSpecification):
    {
         resolution: object(Resolution),  // Refers to object(Resolution) in 5.3, streams data model.
         framerate: number(WantedFrameRateFPS),
         bitrate: number(WantedBitrateKbps) | string(WantedBitrateMultiple),
         keyFrameInterval: number(WantedKeyFrameIntervalSecond)
    }
Resources:

- /v1/rooms/{roomId}/streaming-outs
- /v1/rooms/{roomId}/streaming-outs/{streamOutId}

### /v1/rooms/{roomId}/streaming-outs
#### GET
Description:<br>
　　Get all the ongoing streaming-outs in the specified room.

parameters:

| parameters | type | annotation |
|:----------:|:----:|:----------:|
|    {roomId}    | URL |    Room ID    |
|  undefined | request body | Request body is null |
response body:

| type | content |
|:-------------:|:-------:|
|  json | All the ongoing streaming-outs in the specified room |
#### POST
Description:<br>
　　Start a streaming-out to the specified room.

parameters:

| parameters | type | annotation |
|:----------:|:----:|:----------:|
|    {roomId}    | URL |    Room ID    |
| options | request body | Json format with url and media |

**Note**:

    options={
        url: url,
        media: object(MediaSubOptions)     // Refers to object(MediaSubOptions) in 5.5, streaming-outs model.
    }

response body:

| type | content |
|:-------------:|:-------:|
|  json | The started streaming-out |
### /v1/rooms/{roomId}/streaming-outs/{streaming-outId}
#### PATCH
Description:<br>
　　Update a streaming-out's given attributes in the specified room.

parameters:

| parameters | type | annotation |
|:----------:|:----:|:----------:|
|    {roomId}    | URL |    Room ID    |
| {streaming-outId} | URL | Streaming-out ID|
| items | request body | An array with attributes to be updated|
**Note**: Here is the definition of *items*.<br>

    items=[
        object(SubscriptionControlInfo)
    ]
    object(SubscriptionControlInfo):
    {
        // There are six kind of op, path and value. Choose one of them.

        op: 'replace',
        path: '/media/audio/status' | '/media/video/status',
        value: 'active' | 'inactive'
         OR
        op: 'replace',
        path: '/media/audio/from' | '/media/video/from',
        value: string
         OR
        op: 'replace',
        path: '/media/video/parameters/resolution',
        value: object(Resolution)        // Refers to object(Resolution) in 5.3 streams, streams model.
         OR
        op: 'replace',
        path: '/media/video/parameters/framerate',
        value: '6' | '12' | '15' | '24' | '30' | '48' | '60'
         OR
        op: 'replace',
        path: '/media/video/parameters/bitrate',
        value: 'x0.8' | 'x0.6' | 'x0.4' | 'x0.2'
         OR
        op: 'replace',
        path: '/media/video/parameters/keyFrameInterval',
        value: '1' | '2' | '5' | '30' | '100'
    }
response body:

| type | content |
|:-------------:|:-------:|
|  json | A updated streaming-out's attributes |
#### DELETE
Description:<br>
　　Stop the specified streaming-out in the specified room.

parameters:

| parameters | type | annotation |
|:----------:|:----:|:----------:|
|    {roomId}    | URL |    Room ID    |
| {streaming-outId} | URL | Streaming-out ID|
| undefined | request body | Request body is null |
response body:

| type | content |
|:-------------:|:-------:|
|  text | A message "Streaming-out Id deleted" indicated success |

## 5.6 Recordings
Description:

Recordings data model:

    object(Recordings):
    {
        type: 'recording',
        media: object(MediaSubOptions)
    }

**Note**:<br>
　　*object(MediaSubOptions)* is same as streaming-outs data model in 5.5.

Resources:

- /v1/rooms/{roomId}/recordings
- /v1/rooms/{roomId}/recordings/{recordingId}

### /v1/rooms/{roomId}/recordings
#### GET
Description:<br>
　　Get all the ongoing recordings in the specified room.

parameters:

| parameters | type | annotation |
|:----------:|:----:|:----------:|
|    {roomId}    | URL |    Room ID    |
|  undefined | request body | Request body is null |
response body:

| type | content |
|:-------------:|:-------:|
|  json | All the ongoing recordings in the specified room |
#### POST
Description:<br>
　　Start a recording in the specified room.

parameters:

| parameters | type | annotation |
|:----------:|:----:|:----------:|
|    {roomId}    | URL |    Room ID    |
| options | request body | Json format with container and media |
**Note**:

    options={
        container: string,
        media: object       // Refers to object(MediaSubOptions) in 5.5.
    }
	container={'mp4' | 'mkv' | 'auto' | 'ts'}  // The container type of the recording file, 'auto' by default.
response body:

| type | content |
|:-------------:|:-------:|
|  json | A recording in the specified room |
### /v1/rooms/{roomId}/recordings/{recordingId}
#### PATCH
Description:<br>
　　Update a recording's given attributes in the specified room.

parameters:

| parameters | type | annotation |
|:----------:|:----:|:----------:|
|    {roomId}    | URL |    Room ID    |
|   {recordingId} | URL | Recording ID|
| items | request body  | An array with attributes to be updated|
**Note**:

    items=[
        {
          op: 'test' | 'remove' | 'add' | 'replace' | 'move' | 'copy' ,
          path: string,
          value: json
        }
    ]

response body:

| type | content |
|:-------------:|:-------:|
|  json | A updated recording's attributes in the specified room |
#### DELETE
Description:<br>
　　Stop the specified recording in the specified room.

parameters:

| parameters | type | annotation |
|:----------:|:----:|:----------:|
|    {roomId}    | URL |    Room ID    |
| {recordingId} | URL | Recording ID|
|  undefined | request body | Request body is null |
response body:

| type | content |
|:-------------:|:-------:|
|  text | A message "The specified recording stopped" indicates success|
## 5.7 Token
Description:<br>
　　A token is the ticket for joining the room. The token contains information through which clients can connect to server application. Note that the different rooms may have different network information, so the room must be specified for token resource. The same token cannot be reused if it has been used once. Re-generate token if clients need to connect at the second time.

Data Model:<br>
Token data in Json example:

    object(Tokens):
    {
        room: roomID,
        user: participant's user ID,
        role: participant's role,
        reprefence: object(Preference)
    }
    object(Preference):
    {
        isp: string,
        region: string
    }
Resources:

- /v1/rooms/{roomId}/tokens
### /v1/rooms/{roomId}/tokens
#### POST
Description:<br>
　　Create a new token when a new participant access a room needs to be added.

parameters:

| parameters | type | annotation |
|:----------:|:----:|:----------:|
|    {roomId}    | URL |    Room ID    |
| {preference_body} | request body | Json format with preference, user and role |
**Note**:

    preference_body={
        preference: object,     // Preference of this token would be used to connect through
        user: string,           // Participant's user ID
        role: string            // Participant's role
    }
response body:

| type | content |
|:-------------:|:-------:|
|  json | A token created for a new participant |