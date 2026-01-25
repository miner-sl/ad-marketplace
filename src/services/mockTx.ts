export const mockTx = JSON.parse(
`
{
  "ok": true,
  "result": [
    {
      "@type": "ext.transaction",
      "address": {
        "@type": "accountAddress",
        "account_address": "EQAlkiTak6MlHRgaImxjUdb3SsEE7PA43ZxGGzZ8Cm2hOE2N"
      },
      "account": "0:259224DA93A3251D181A226C6351D6F74AC104ECF038DD9C461B367C0A6DA138",
      "utime": 1769309420063,
      "data": "te6cckECDAEAAlUAA7VyWSJNqToyUdGBoibGNR1vdKwQTs8DjdnEYbNnwKbaE4AAA7B2ep74H8K04YtrzoPS7BTP76etJhNwi4HokyRWwds9cZt56ocgAAOwdmtcuDaUgVnwADRlXLmIAQIDAgHgBAUAgnJAgvO9DK+41li+FvMn7+lhNuC+1zYkADGzJwHx9Rt1CV+y0bm91ukYOrXQlk+FSa7lQT9+3SxqdYTeOWH8L3oQAg8MQkYY8SmEQAoLAeWIAEskSbUnRko6MDRE2Majre6VggnZ4HG7OIw2bPgU20JwA5tLO3P///iLSkC2QAAAA1UYjZrK7eeM3YLETVEWbfh2oE9VPqxWCDfJL7tHcCzeD5CXsIgxxoD59IO9UFcqBFDhIQWFZzaRSrFmXXWTpVYHBgEB3wkCCg7DyG2CBwgAAABoQgBsvv5q9ndaq+MFRp8btOI0IKssSoWnfNj4Q9erdGg4niL/ofQAAAAAAAAAAAAAAAAAAACxSABLJEm1J0ZKOjA0RNjGo63ulYIJ2eBxuziMNmz4FNtCcQA2X381ezutVfGCo0+N2nEaEFWWJULTvmx8IevVujQcTxF/FRwcBggjWgAAdg7PU98E0pArPkAAnUJpYxOIAAAAAAAAAAAjwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAb8mDDUBMCCNMAAAAAAACAAAAAAADR0FpP7Y/0gJ7cAFlpA/vQxYT8iFX9zTATXVZjXYb4/RAUBYMMfebUQ==",
      "transaction_id": {
        "@type": "internal.transactionId",
        "lt": "64902990000001",
        "hash": "+CVnW1C51urxNnlK9iuMaIuDHkEvvJ2AjzgEHLfeZQo="
      },
      "fee": "3078009",
      "storage_fee": "9",
      "other_fee": "3078000",
      "in_msg": {
        "@type": "ext.message",
        "hash": "o5ZFWjAY3g2/lvMTsld8XG7b/aMGZmFaGmgHKb+7hKo=",
        "source": "",
        "destination": "EQAlkiTak6MlHRgaImxjUdb3SsEE7PA43ZxGGzZ8Cm2hOE2N",
        "value": "0",
        "extra_currencies": [],
        "fwd_fee": "0",
        "ihr_fee": "0",
        "created_lt": "0",
        "body_hash": "PLIca44QwFpgSr+Pztp0W8mnQOhG3BxpCsjVHXjA8+c=",
        "msg_data": {
          "@type": "msg.dataRaw",
          "body": "te6cckEBBAEAlQABoXNpZ25///8RaUgWyAAAAGqjEbNZXbzxm7BYiaoizb8O1Anqp9WKwQb5Jfdo7gWbwfIS9hEGONAfPpB3qgrlQIocJCCwrObSKVYsy66ydKrA4AECCg7DyG2CAgMAAABoQgBsvv5q9ndaq+MFRp8btOI0IKssSoWnfNj4Q9erdGg4niL/ofQAAAAAAAAAAAAAAAAAAIzo5UU=",
          "init_state": ""
        },
        "message": "c2lnbn///xFpSBbIAAAAaqMRs1ldvPGbsFiJqiLNvw7UCeqn1YrBBvkl92juBZvB8hL2EQY40B8+kHeqCuVAihwkILCs5tIpVizLrrJ0qsDA\\n"
      },
      "out_msgs": [
        {
          "@type": "ext.message",
          "hash": "23Yrs1UbvcvmMvl51SLMrA6LVOuGAzdaomdcOjBNvcI=",
          "source": "EQAlkiTak6MlHRgaImxjUdb3SsEE7PA43ZxGGzZ8Cm2hOE2N",
          "destination": "EQDZffzV7O61V8YKjT43acRoQVZYlQtO-bHwh69W6NBxPDbK",
          "value": "25500000000",
          "extra_currencies": [],
          "fwd_fee": "266669",
          "ihr_fee": "0",
          "created_lt": "64902990000002",
          "body_hash": "lqKW0iTyhcZ77pPDD4owkVfw2qNdxbh+QQt4YwoJz8c=",
          "msg_data": {
            "@type": "msg.dataRaw",
            "body": "te6cckEBAQEAAgAAAEysuc0=",
            "init_state": ""
          },
          "message": "\\n"
        }
      ]
    },
    {
      "@type": "ext.transaction",
      "address": {
        "@type": "accountAddress",
        "account_address": "EQAlkiTak6MlHRgaImxjUdb3SsEE7PA43ZxGGzZ8Cm2hOE2N"
      },
      "account": "0:259224DA93A3251D181A226C6351D6F74AC104ECF038DD9C461B367C0A6DA138",
      "utime": 1769309420063,
      "data": "te6cckECBwEAAZkAA7VyWSJNqToyUdGBoibGNR1vdKwQTs8DjdnEYbNnwKbaE4AAA7B2a1y4MIOnk443fP2Ij+Z3SvROi/sNsk8C5xIfu4DZNi/6DpTgAAOcI63P2BaUgVewABRiNE4IAQIDAQGgBACCcspcClZKDyIkBpCst6UvyTGTphWZ1u0nONvSkv0D+q9mQILzvQyvuNZYvhbzJ+/pYTbgvtc2JAAxsycB8fUbdQkCGwzDOLQJGAF4PBhgl/QRBQYAuUgBkgam38Qm5D8rdYcIBHodYlYo2ik+KVV9kZXeDUDVFOMACWSJNqToyUdGBoibGNR1vdKwQTs8DjdnEYbNnwKbaE4RgBeDwAYII1oAAHYOzWuXBNKQKvYAAAAAQACeQGFMPQkAAAAAAAAAAAAXAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABbwAAAAAAAAAAAAAAAAS1FLaRJ5QuM990nhh8UYSKv4bVGu4tw/IIW8MYUE5+OBC0e5hc=",
      "transaction_id": {
        "@type": "internal.transactionId",
        "lt": "64902974000003",
        "hash": "/CtOGLa86D0uwUz++nrSYTcIuB6JMkVsHbPXGbeeqHI="
      },
      "fee": "1155696",
      "storage_fee": "844496",
      "other_fee": "311200",
      "in_msg": {
        "@type": "ext.message",
        "hash": "24puZ0vajrHm7vUekknAHjwQnuj/6jw4nxweUK8ra8I=",
        "source": "EQDJA1Nv4hNyH5W6w4QCPQ6xKxRtFJ8Uqr7Iyu8GoGqKcbbC",
        "destination": "EQAlkiTak6MlHRgaImxjUdb3SsEE7PA43ZxGGzZ8Cm2hOE2N",
        "value": "25500000000",
        "extra_currencies": [],
        "fwd_fee": "266669",
        "ihr_fee": "0",
        "created_lt": "64902974000002",
        "body_hash": "P+k4lxWGmOTUc7dEFNdJNxaw/DpwMQk0hz8AGdqsyrQ=",
        "msg_data": {
          "@type": "msg.dataText",
          "text": ""
        },
        "message": ""
      },
      "out_msgs": []
    }
   ]
}`
)