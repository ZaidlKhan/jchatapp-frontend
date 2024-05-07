import React, { useState, useEffect, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Image, Button } from 'react-native';
import axios from 'axios';
import {
  renderTextMessage,
  renderImageMessage,
  renderVideoMessage,
  renderMediaShare,
  renderLinkMessage
} from './Renderer'; 

const ChatMessages = ({ route, navigation }) => {
  const { chatList } = route.params;
  const senderPic = chatList.inviter.profile_pic_url;
  const receiverPic = chatList.users[0].profile_pic_url;
  const receiverName = chatList.users[0].full_name;
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [loadingNewMessages, setLoadingNewMessages] = useState(false);
  const [cursor, setCursor] = useState(null);
  const [moreAvailable, setMoreAvailable] = useState(true);
  const [messages, setMessages] = useState(chatList.items || []);
  const [lastTimestamp, setLastTimestamp] = useState(messages[messages.length - 1]?.timestamp);
  const [messageIds, setMessageIds] = useState(new Set(chatList.items.map(item => item.item_id)));
  const flatListRef = useRef();

  useEffect(() => {
    setMessages(chatList.items.sort((a, b) => b.timestamp - a.timestamp));
  }, [chatList.items]);

  const fetchNewMessages = async () => {
    if (loadingNewMessages) return;
    setLoadingNewMessages(true);
    try {
      const response = await axios.get(`http://10.0.2.2:8000/chats/${chatList.thread_id}/new_messages`, {
        params: { last_timestamp: lastTimestamp }
      });
      if (response.data && response.data.messages.length > 0) {
        setMessages(currentMessages => {
          const newUniqueMessages = response.data.messages.filter(msg => !messageIds.has(msg.item_id));
  
          newUniqueMessages.forEach(msg => messageIds.add(msg.item_id));

          const updatedMessages = [...newUniqueMessages, ...currentMessages];
          setLastTimestamp(updatedMessages[0].timestamp); 
          return updatedMessages;
        });
      }
    } catch (error) {
      console.error('Failed to fetch new messages:', error);
    }
    setLoadingNewMessages(false);
  };
  
  useEffect(() => {
    const intervalId = setInterval(fetchNewMessages, 10000); 
    return () => clearInterval(intervalId); 
  }, [fetchNewMessages]);

  const fetchOlderMessages = async (threadId, cursor) => {
    try {
      const response = await axios.get(`http://10.0.2.2:8000/chats/${threadId}/messages`, {
        params: { cursor }
      });
      return response.data;
    } catch (error) {
      console.error('Failed to load older messages:', error);
    }
  };

  
  const loadOlderMessages = async () => {
    if (loadingOlderMessages || !moreAvailable) return;
  
    setLoadingOlderMessages(true);
    const result = await fetchOlderMessages(chatList.thread_id, cursor);
  
    if (result.moreAvailable === false) {
      setMoreAvailable(false); 
      setLoadingOlderMessages(false);
      return;
    }
  
    if (result.messages && result.messages.length > 0) {
      const filteredMessages = result.messages.filter(msg => !messageIds.has(msg.item_id));
      const newMessageIds = new Set([...messageIds, ...filteredMessages.map(msg => msg.item_id)]);
      setMessages(prevMessages => [...prevMessages, ...filteredMessages]);
      setMessageIds(newMessageIds);
    }
    setCursor(result.cursor);
    setLoadingOlderMessages(false);
  };

  const renderItem = ({ item, index }) => {
    const isSender = item.is_sent_by_viewer; 
    const profilePicUrl = isSender ? senderPic : receiverPic;

    const prevMessage = index > 0 ? messages[index - 1] : null;
    const isFirstFromSender = !prevMessage || prevMessage.is_sent_by_viewer !== isSender;

    let messageContent;
    switch (item.item_type) {
      case 'text':
        messageContent = renderTextMessage(item, profilePicUrl, isSender);
        break;

      case 'media':
        const hasVideo = item.media && item.media.video_versions;
        if (hasVideo) {
          const bestVideo = item.media.video_versions[0];
          messageContent = renderVideoMessage(bestVideo.url, profilePicUrl, isSender, bestVideo.width, bestVideo.height);
        } else {
          let bestImg = item.media.image_versions2.candidates.reduce((prev, curr) => (prev.height > curr.height) ? prev : curr);
          messageContent = renderImageMessage(bestImg.url, profilePicUrl, isSender, bestImg.width, bestImg.height);
        }
        break;

      case 'media_share':
        messageContent = renderMediaShare(item.media_share, profilePicUrl, isSender);
        break;

      default:
        messageContent = <Text style={styles.messageText}>Unsupported message type</Text>;
        break;
    }

    return (
      <View style={[
        styles.messageContainer,
        isSender ? styles.senderContainer : styles.receiverContainer
      ]}>
        {!isSender && (
          <View style={styles.profileImagePlaceholder}>
            {isFirstFromSender && (
              <Image
                style={styles.profileImage}
                source={{ uri: profilePicUrl }}
              />
            )}
          </View>
        )}
        {messageContent}
      </View>
    );
  };


  return (
    <View style={{ flex: 1 }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Image
            source={require('./assets/back_arrow.png')}
            style={{ width: 20, height: 20 }}
          />
        </TouchableOpacity>
        <Image source={{ uri: receiverPic }} 
        style={{ width: 40, height: 40, borderRadius: 20, marginHorizontal: 10, marginVertical: 4}}/>
        <Text style={styles.receiverName}>{receiverName}</Text>
      </View>
      <View style={styles.separatorLine}></View>
      <FlatList
          data={messages}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          inverted 
          ref={flatListRef}
          onEndReached={loadOlderMessages} 
          onEndReachedThreshold={0.1} 
          ListFooterComponent={() => 
        loadingOlderMessages ? <Text>Loading...</Text> : null
      }
    />
    </View>
  );
};

const styles = StyleSheet.create({
  profileImagePlaceholder: {
    width: 40,
    height: 40,
    marginRight: 5, 
    backgroundColor: 'transparent', 
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 5,
    paddingTop: 30
  },
  backButton: {
    padding: 10,
    justifyContent: 'center', 
    alignItems: 'center',
    width: 44, 
    height: 44,
  },
  receiverName: {
    fontSize: 18
  },
  messageContainer: {
    flexDirection: 'row',
    padding: 5,
    marginHorizontal: 4,
  },
  senderContainer: {
    justifyContent: 'flex-end',
  },
  receiverContainer: {
    justifyContent: 'flex-start',
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    padding: 5
  },
  separatorLine: {
    height: 1,           
    backgroundColor: 'gray', 
    width: '100%',     
  },
  messageBox: {
    borderRadius: 10,
    padding: 10,
    maxWidth: '70%',
  },
  senderMessageBox: {
    backgroundColor: 'skyblue',
  },
  receiverMessageBox: {
    backgroundColor: 'gray',
    borderWidth: 1,
    borderColor: 'lightgray',
  },
  messageText: {
    fontSize: 16,
  },
  textWhite: {
    color: 'white',
  },
  textBlack: {
    color: 'white',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '50%',
    backgroundColor: 'gray',
    paddingLeft: 20,
  },
  captionStyle: {
    color: 'gray',  
    fontSize: 12, 
    textAlign: 'left',
    maxWidth: 200, 
    marginHorizontal: 10, 
},

});


export default ChatMessages;