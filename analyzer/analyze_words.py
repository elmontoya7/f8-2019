import os
from wit import Wit

client = Wit(os.environ['WIT_TOKEN'])


def analyze_words(dataset):
    failed_words = []
    with open('analyzer/{}.txt'.format(dataset)) as trigger_words:
        for words in trigger_words:
            words = words.strip()
            resp = client.message(words)
            print("words:", words)
            try:
                sentiment_value = str(resp["entities"]["sentiment"][0]["value"])

            except KeyError:
                failed_words.append(words)
            else:
                print("response:", str(resp["entities"]["sentiment"][0]["value"]))

    with open('analyzer/failed_words_{}.txt'.format(dataset), 'w') as failed_output:
        for item in failed_words:
            failed_output.write("%s\n" % item)
    return True
        # print("response type:", type(resp))
        # print("response.keys():", resp.keys())
        # return resp
